import os
import sqlite3
from sqlalchemy.orm import Session
from app.database import engine, Base
from app.models.user import User
from app.models.connection import DatabaseConnection, QueryAuditLog, DatabaseSchemaCache
from app.core.auth.hashing import hash_password
from app.core.connections.connector import get_connection
from app.core.schema.introspector import reflect_database_schema

def create_demo_sales_sqlite():
    """
    Creates a local demo sales SQLite database with sample records and tables.
    Matches standard business intelligence structures.
    """
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "demo_sales.db")
    
    # Remove existing demo sales SQLite file if present to fresh-seed
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception:
            pass

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create tables resiliently if they do not exist
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        segment TEXT,
        created_at TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        product_name TEXT NOT NULL,
        category TEXT,
        price REAL,
        stock INTEGER
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER,
        product_name TEXT,
        quantity INTEGER,
        total_amount REAL,
        order_date TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sales_leads (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        score REAL,
        conversion_rate REAL
    );
    """)

    # Clear existing rows to prevent unique key / primary key duplicate errors if the file is locked and could not be deleted
    cursor.execute("DELETE FROM customers")
    cursor.execute("DELETE FROM products")
    cursor.execute("DELETE FROM orders")
    cursor.execute("DELETE FROM sales_leads")

    # Seed data
    customers = [
        (1, "Acme Corp", "info@acme.com", "Enterprise", "2026-01-15"),
        (2, "Stark Industries", "tony@stark.com", "Enterprise", "2026-02-20"),
        (3, "Wayne Enterprises", "bruce@wayne.com", "Mid-Market", "2026-03-05"),
        (4, "Globex Corporation", "hank@globex.com", "Mid-Market", "2026-04-10"),
        (5, "Initech", "peter@initech.com", "SMB", "2026-05-12")
    ]
    cursor.executemany("INSERT INTO customers VALUES (?, ?, ?, ?, ?)", customers)

    products = [
        (1, "Premium Analytics License", "Software", 4999.00, 100),
        (2, "Developer Seat Subscription", "Software", 199.00, 500),
        (3, "Enterprise Onboarding Package", "Services", 15000.00, 10),
        (4, "Standard API Token Pack", "Software", 49.00, 1000),
        (5, "Dedicated Server Module", "Hardware", 2500.00, 20)
    ]
    cursor.executemany("INSERT INTO products VALUES (?, ?, ?, ?, ?)", products)

    orders = [
        (1, 1, "Premium Analytics License", 2, 9998.00, "2026-06-01"),
        (2, 1, "Developer Seat Subscription", 10, 1990.00, "2026-06-02"),
        (3, 2, "Enterprise Onboarding Package", 1, 15000.00, "2026-06-10"),
        (4, 3, "Premium Analytics License", 1, 4999.00, "2026-06-12"),
        (5, 3, "Developer Seat Subscription", 5, 995.00, "2026-06-12"),
        (6, 4, "Standard API Token Pack", 50, 2450.00, "2026-06-15"),
        (7, 5, "Developer Seat Subscription", 2, 398.00, "2026-06-18"),
        (8, 2, "Standard API Token Pack", 10, 490.00, "2026-06-20"),
        (9, 4, "Premium Analytics License", 3, 14997.00, "2026-06-22"),
        (10, 5, "Standard API Token Pack", 5, 245.00, "2026-06-25")
    ]
    cursor.executemany("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?)", orders)

    # Includes NULL and NaN values to represent incomplete lead data (realistic scenario)
    leads = [
        (1, "LexCorp", 95.5, 0.85),
        (2, "Oscorp", None, 0.40),
        (3, "Umbrella Corp", float('nan'), None),
        (4, "Tyrell Corp", 88.0, 0.75)
    ]
    cursor.executemany("INSERT INTO sales_leads VALUES (?, ?, ?, ?)", leads)

    conn.commit()
    conn.close()
    return db_path

from typing import Optional

def seed_platform_database(db_session: Optional[Session] = None):
    """
    Ensures platform metadata tables exist, registers the default test account,
    links the local demo connection, auto-caches schema layout trees, and pre-populates
    query history lists.
    """
    if db_session is not None:
        db = db_session
    else:
        # Check connection status of target database engine, falling back to local SQLite if unreachable
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from app.config import settings
        
        target_url = settings.DATABASE_URL
        active_engine = engine
        
        if "postgresql" in target_url:
            try:
                # Try simple connection check with short timeout
                test_engine = create_engine(target_url, connect_args={"connect_timeout": 2})
                test_engine.connect().close()
                active_engine = test_engine
            except Exception:
                print("PostgreSQL server unreachable at localhost. Seeding local SQLite database ('sqlite:///schemasay.db') instead.")
                settings.DATABASE_URL = "sqlite:///schemasay.db"
                active_engine = create_engine("sqlite:///schemasay.db", connect_args={"check_same_thread": False})
                
        Base.metadata.create_all(bind=active_engine)
        SessionMaker = sessionmaker(bind=active_engine)
        db = SessionMaker()
    
    try:
        # 2. Find or create the demo user account
        demo_email = "demo@schemasay.com"
        user = db.query(User).filter(User.email == demo_email).first()
        if not user:
            user = User(
                email=demo_email,
                hashed_password=hash_password("Password123!"),
                full_name="Demo Workspace User",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # 3. Create the demo sales SQLite database
        sqlite_file_path = create_demo_sales_sqlite()

        # 4. Register the demo database connection
        conn_name = "Demo Sales SQLite"
        connection = db.query(DatabaseConnection).filter(
            DatabaseConnection.name == conn_name,
            DatabaseConnection.user_id == user.id
        ).first()

        if not connection:
            connection = DatabaseConnection(
                user_id=user.id,
                name=conn_name,
                db_type="sqlite",
                database_name=sqlite_file_path,
                username="",
                host="",
                port=None
            )
            db.add(connection)
            db.commit()
            db.refresh(connection)

        # 5. Populate the schema cache
        db.query(DatabaseSchemaCache).filter(
            DatabaseSchemaCache.connection_id == connection.id
        ).delete()

        conn_engine = get_connection(connection)
        metadata_list = reflect_database_schema(conn_engine)

        cache_entries = [
            DatabaseSchemaCache(
                connection_id=connection.id,
                table_name=entry["table_name"],
                column_name=entry["column_name"],
                data_type=entry["data_type"]
            )
            for entry in metadata_list
        ]
        db.bulk_save_objects(cache_entries)

        # 6. Pre-populate the query history log
        db.query(QueryAuditLog).filter(
            QueryAuditLog.user_id == user.id,
            QueryAuditLog.connection_id == connection.id
        ).delete()

        audit_logs = [
            QueryAuditLog(
                user_id=user.id,
                connection_id=connection.id,
                question="What are our total customer records?",
                sql_query="SELECT COUNT(*) AS total_customers FROM customers",
                execution_duration_ms=4,
                status="success"
            ),
            QueryAuditLog(
                user_id=user.id,
                connection_id=connection.id,
                question="List top 5 most expensive products",
                sql_query="SELECT product_name, price FROM products ORDER BY price DESC LIMIT 5",
                execution_duration_ms=6,
                status="success"
            ),
            QueryAuditLog(
                user_id=user.id,
                connection_id=connection.id,
                question="Show total quantity sold per product",
                sql_query="SELECT product_name, SUM(quantity) AS quantity_sold FROM orders GROUP BY product_name",
                execution_duration_ms=8,
                status="success"
            ),
            QueryAuditLog(
                user_id=user.id,
                connection_id=connection.id,
                question="Manual SQL Editor Query",
                sql_query="SELECT * FROM customers LIMIT 10",
                execution_duration_ms=5,
                status="success"
            )
        ]
        db.bulk_save_objects(audit_logs)
        db.commit()
        print("Demo workspace database successfully seeded out-of-the-box!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {str(e)}")
        raise e
    finally:
        if db_session is None:
            db.close()

if __name__ == "__main__":
    seed_platform_database()
