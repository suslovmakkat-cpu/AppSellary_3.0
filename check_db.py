import sqlite3

conn = sqlite3.connect("operators.db")
cur = conn.cursor()

tables = ["operators", "manual_calculations", "payments", "motivations"]

for table in tables:
    print("\nTABLE:", table)
    try:
        for row in cur.execute(f"PRAGMA table_info({table})"):
            print(row)
    except Exception as e:
        print("NOT FOUND")

conn.close()
