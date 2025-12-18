import sqlite3

conn = sqlite3.connect("operators.db")
cur = conn.cursor()

def has_column(table, column):
    cols = [row[1] for row in cur.execute(f"PRAGMA table_info({table})")]
    return column in cols

def add_column(table, column_def):
    cur.execute(f"ALTER TABLE {table} ADD COLUMN {column_def}")

# operators
if not has_column("operators", "is_deleted"):
    add_column("operators", "is_deleted INTEGER DEFAULT 0")
if not has_column("operators", "deleted_at"):
    add_column("operators", "deleted_at TIMESTAMP")
if not has_column("operators", "motivation_id"):
    add_column("operators", "motivation_id INTEGER")

# manual_calculations
if not has_column("manual_calculations", "is_deleted"):
    add_column("manual_calculations", "is_deleted INTEGER DEFAULT 0")
if not has_column("manual_calculations", "deleted_at"):
    add_column("manual_calculations", "deleted_at TIMESTAMP")

# payments
if not has_column("payments", "is_deleted"):
    add_column("payments", "is_deleted INTEGER DEFAULT 0")
if not has_column("payments", "deleted_at"):
    add_column("payments", "deleted_at TIMESTAMP")

# motivations table
cur.execute("""
CREATE TABLE IF NOT EXISTS motivations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    motivation_type TEXT NOT NULL,
    config_json TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

conn.commit()
conn.close()

print("DB migration completed successfully")
