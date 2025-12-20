import sqlite3
from typing import Iterable, Tuple

DB_PATH = 'operators.db'


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_table(conn: sqlite3.Connection, create_sql: str) -> None:
    conn.execute(create_sql)


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


def _ensure_settings(conn: sqlite3.Connection, items: Iterable[Tuple[str, str, str]]) -> None:
    conn.executemany(
        """
        INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description)
        VALUES (?, ?, ?)
        """,
        list(items),
    )


def ensure_schema() -> None:
    conn = _get_connection()

    _ensure_table(
        conn,
        """
        CREATE TABLE IF NOT EXISTS operators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            salary_type TEXT DEFAULT 'progressive',
            base_percent REAL,
            tax_bonus REAL DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            is_deleted INTEGER DEFAULT 0,
            deleted_at TIMESTAMP,
            motivation_id INTEGER,
            created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
    )

    _ensure_table(
        conn,
        """
        CREATE TABLE IF NOT EXISTS manual_calculations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operator_id INTEGER NOT NULL,
            kc_amount REAL DEFAULT 0,
            non_kc_amount REAL DEFAULT 0,
            kc_percent REAL DEFAULT 0,
            sales_amount REAL DEFAULT 0,
            total_salary REAL DEFAULT 0,
            redemption_percent REAL DEFAULT 0,
            manual_fixed_bonus REAL DEFAULT 0,
            manual_penalty REAL DEFAULT 0,
            bonus_percent_salary REAL DEFAULT 0,
            bonus_percent_sales REAL DEFAULT 0,
            applied_motivation_id INTEGER,
            applied_motivation_name TEXT,
            motivation_snapshot TEXT,
            calculation_breakdown TEXT,
            calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            period_start TEXT,
            period_end TEXT,
            additional_bonus REAL DEFAULT 0,
            penalty_amount REAL DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            deleted_at TIMESTAMP,
            working_days_in_period REAL DEFAULT 0,
            plan_target REAL DEFAULT 0,
            plan_completion REAL DEFAULT 0,
            include_redemption_percent INTEGER DEFAULT 1,
            correction_date TEXT
        )
        """,
    )

    _ensure_table(
        conn,
        """
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operator_id INTEGER NOT NULL,
            calculation_date DATE,
            total_salary REAL DEFAULT 0,
            is_paid INTEGER DEFAULT 0,
            payment_date DATE,
            period_start DATE,
            period_end DATE,
            sales_amount REAL DEFAULT 0,
            additional_bonus REAL DEFAULT 0,
            penalty_amount REAL DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            deleted_at TIMESTAMP,
            correction_date TEXT,
            FOREIGN KEY (operator_id) REFERENCES operators (id)
        )
        """,
    )

    _ensure_table(
        conn,
        """
        CREATE TABLE IF NOT EXISTS system_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key TEXT UNIQUE NOT NULL,
            setting_value TEXT,
            description TEXT
        )
        """,
    )

    _ensure_table(
        conn,
        """
        CREATE TABLE IF NOT EXISTS action_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action_type TEXT NOT NULL,
            action_details TEXT,
            operator_id INTEGER,
            performed_by TEXT,
            action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
    )

    _ensure_table(
        conn,
        """
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
        """,
    )

    _ensure_column(conn, "operators", "is_deleted", "INTEGER DEFAULT 0")
    _ensure_column(conn, "operators", "deleted_at", "TIMESTAMP")
    _ensure_column(conn, "operators", "motivation_id", "INTEGER")

    _ensure_column(conn, "manual_calculations", "period_start", "TEXT")
    _ensure_column(conn, "manual_calculations", "period_end", "TEXT")
    _ensure_column(conn, "manual_calculations", "additional_bonus", "REAL DEFAULT 0")
    _ensure_column(conn, "manual_calculations", "penalty_amount", "REAL DEFAULT 0")
    _ensure_column(conn, "manual_calculations", "comment", "TEXT")
    _ensure_column(conn, "manual_calculations", "redemption_percent", "REAL DEFAULT 0")
    _ensure_column(conn, "manual_calculations", "manual_fixed_bonus", "REAL DEFAULT 0")
    _ensure_column(conn, "manual_calculations", "manual_penalty", "REAL DEFAULT 0")
    _ensure_column(conn, "manual_calculations", "bonus_percent_salary", "REAL DEFAULT 0")
    _ensure_column(conn, "manual_calculations", "bonus_percent_sales", "REAL DEFAULT 0")
    _ensure_column(conn, "manual_calculations", "applied_motivation_id", "INTEGER")
    _ensure_column(conn, "manual_calculations", "applied_motivation_name", "TEXT")
    _ensure_column(conn, "manual_calculations", "motivation_snapshot", "TEXT")
    _ensure_column(conn, "manual_calculations", "calculation_breakdown", "TEXT")
    _ensure_column(conn, "manual_calculations", "is_deleted", "INTEGER DEFAULT 0")
    _ensure_column(conn, "manual_calculations", "deleted_at", "TEXT")
    _ensure_column(conn, "manual_calculations", "working_days_in_period", "REAL DEFAULT 0")
    _ensure_column(conn, "manual_calculations", "plan_target", "REAL DEFAULT 0")
    _ensure_column(conn, "manual_calculations", "plan_completion", "REAL DEFAULT 0")
    _ensure_column(conn, "manual_calculations", "include_redemption_percent", "INTEGER DEFAULT 1")
    _ensure_column(conn, "manual_calculations", "correction_date", "TEXT")

    _ensure_column(conn, "payments", "calculation_id", "INTEGER")
    _ensure_column(conn, "payments", "correction_date", "TEXT")

    _ensure_column(conn, "payments", "period_start", "DATE")
    _ensure_column(conn, "payments", "period_end", "DATE")
    _ensure_column(conn, "payments", "sales_amount", "REAL DEFAULT 0")
    _ensure_column(conn, "payments", "additional_bonus", "REAL DEFAULT 0")
    _ensure_column(conn, "payments", "penalty_amount", "REAL DEFAULT 0")
    _ensure_column(conn, "payments", "is_deleted", "INTEGER DEFAULT 0")
    _ensure_column(conn, "payments", "deleted_at", "TIMESTAMP")

    _ensure_settings(
        conn,
        [
            ("auto_create_payments", "true", "Automatic payment creation"),
        ],
    )

    conn.commit()
    conn.close()


if __name__ == "__main__":
    ensure_schema()
