"""Create a pre-populated SQLite database for demos and first-run onboarding."""

from __future__ import annotations

import sqlite3
import uuid

from app.core.security.connection_policy import validate_sqlite_path

# Commerce-focused seed aligned with eval fixtures (orders, users, products, order_items).
SAMPLE_STORE_DDL = """
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT);
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT);
CREATE TABLE orders (
    id INTEGER PRIMARY KEY, user_id INTEGER, price REAL, quantity INTEGER,
    status TEXT, created_at TEXT, notes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER,
    price REAL, quantity INTEGER,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

INSERT INTO users VALUES (1, 'Alice', 'alice@example.com'), (2, 'Bob', 'bob@example.com');
INSERT INTO products VALUES (1, 'Widget', 'hardware'), (2, 'Gadget', 'hardware'), (3, 'SaaS Plan', 'software');
INSERT INTO orders VALUES
    (1, 1, 100.0, 2, 'active', '2024-06-01', NULL),
    (2, 1, 50.0, 1, 'completed', '2024-06-15', 'rush'),
    (3, 2, 200.0, 3, 'active', '2024-07-01', NULL);
INSERT INTO order_items VALUES
    (1, 1, 1, 40.0, 2), (2, 1, 2, 20.0, 1),
    (3, 2, 3, 50.0, 1), (4, 3, 1, 200.0, 3);
"""


def create_sample_sqlite_path() -> str:
    """Build a new SQLite file under the approved app data directory."""
    filename = f"sample_store_{uuid.uuid4().hex[:12]}.db"
    db_path = validate_sqlite_path(filename, must_exist=False)
    connection = sqlite3.connect(db_path)
    try:
        connection.executescript(SAMPLE_STORE_DDL)
        connection.commit()
    finally:
        connection.close()
    return db_path
