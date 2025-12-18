import sqlite3
from datetime import datetime

from schema_manager import ensure_schema

DB_PATH = 'operators.db'

ensure_schema()


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def log_action(action_type, details=None, operator_id=None, performed_by='system'):
    conn = get_db_connection()
    conn.execute(
        'INSERT INTO action_log (action_type, action_details, operator_id, performed_by) VALUES (?, ?, ?, ?)',
        (action_type, details, operator_id, performed_by)
    )
    conn.commit()
    conn.close()

def get_system_settings():
    conn = get_db_connection()
    settings = conn.execute('SELECT * FROM system_settings').fetchall()
    conn.close()
    return {setting['setting_key']: setting['setting_value'] for setting in settings}
