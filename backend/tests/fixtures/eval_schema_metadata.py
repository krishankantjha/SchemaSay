"""Shared schema metadata and seed DDL for heuristic evaluation benchmarks."""

EVAL_SCHEMA_METADATA = [
    {"table_name": "orders", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "orders", "column_name": "user_id", "data_type": "INTEGER | FOREIGN KEY -> users.id"},
    {"table_name": "orders", "column_name": "price", "data_type": "FLOAT"},
    {"table_name": "orders", "column_name": "quantity", "data_type": "INTEGER"},
    {"table_name": "orders", "column_name": "status", "data_type": "TEXT"},
    {"table_name": "orders", "column_name": "created_at", "data_type": "TIMESTAMP"},
    {"table_name": "orders", "column_name": "notes", "data_type": "TEXT"},
    {"table_name": "users", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "users", "column_name": "name", "data_type": "TEXT"},
    {"table_name": "users", "column_name": "email", "data_type": "TEXT"},
    {"table_name": "order_items", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "order_items", "column_name": "order_id", "data_type": "INTEGER | FOREIGN KEY -> orders.id"},
    {"table_name": "order_items", "column_name": "product_id", "data_type": "INTEGER | FOREIGN KEY -> products.id"},
    {"table_name": "order_items", "column_name": "price", "data_type": "FLOAT"},
    {"table_name": "order_items", "column_name": "quantity", "data_type": "INTEGER"},
    {"table_name": "products", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "products", "column_name": "name", "data_type": "TEXT"},
    {"table_name": "products", "column_name": "category", "data_type": "TEXT"},
    {"table_name": "enrollments", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "enrollments", "column_name": "student_id", "data_type": "INTEGER | FOREIGN KEY -> students.id"},
    {"table_name": "enrollments", "column_name": "course_id", "data_type": "INTEGER | FOREIGN KEY -> courses.id"},
    {"table_name": "enrollments", "column_name": "grade", "data_type": "FLOAT"},
    {"table_name": "students", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "students", "column_name": "name", "data_type": "TEXT"},
    {"table_name": "courses", "column_name": "id", "data_type": "INTEGER | PRIMARY KEY"},
    {"table_name": "courses", "column_name": "title", "data_type": "TEXT"},
]

EVAL_SEED_DDL = """
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
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT);
CREATE TABLE enrollments (
    id INTEGER PRIMARY KEY, student_id INTEGER, course_id INTEGER, grade REAL,
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(course_id) REFERENCES courses(id)
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
INSERT INTO students VALUES (1, 'Sam'), (2, 'Jordan');
INSERT INTO courses VALUES (1, 'SQL 101'), (2, 'Data Modeling');
INSERT INTO enrollments VALUES (1, 1, 1, 92.0), (2, 2, 2, 88.0);
"""
