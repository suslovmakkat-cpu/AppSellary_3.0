import sqlite3

conn = sqlite3.connect("operators.db")
cur = conn.cursor()

def has_column(table, column):
    cols = [row[1] for row in cur.execute(f"PRAGMA table_info({table})")]
    return column in cols

def add_column(table, column_def):
    cur.execute(f"ALTER TABLE {table} ADD COLUMN {column_def}")

# Simple motivation fields
fields = [
    ("base_salary", "REAL DEFAULT 0"),
    ("advance_redemption_percent", "REAL DEFAULT 0"),
    ("final_redemption_percent", "REAL DEFAULT 0"),
    ("redemption_from", "REAL"),
    ("redemption_to", "REAL"),
    ("percent_from_sales", "REAL DEFAULT 0"),
    ("percent_from_redemption", "REAL DEFAULT 0"),
    ("bonus_amount", "REAL DEFAULT 0"),
]

for name, definition in fields:
    if not has_column("motivations", name):
        add_column("motivations", f"{name} {definition}")

conn.commit()
conn.close()

print("Motivations fields migration completed")
