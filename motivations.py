import json
from datetime import datetime

from config import get_db_connection, log_action

# READ
# =========================

def get_motivations(include_deleted=False):
    conn = get_db_connection()
    query = "SELECT * FROM motivations WHERE 1=1"
    params = []
    if not include_deleted:
        query += " AND is_deleted = 0 AND is_active = 1"
    query += " ORDER BY name"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_deleted_motivations():
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM motivations WHERE is_deleted = 1 ORDER BY deleted_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_motivation(motivation_id):
    conn = get_db_connection()
    row = conn.execute(
        "SELECT * FROM motivations WHERE id = ?",
        (motivation_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


# =========================
# CREATE / UPDATE
# =========================

def add_motivation(name, motivation_type, config_json, description=None):
    # config_json must be valid JSON string
    json.loads(config_json)
    motivation_type = motivation_type or "composite"

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO motivations (name, motivation_type, config_json, description)
        VALUES (?, ?, ?, ?)
        """,
        (name, motivation_type, config_json, description)
    )
    mid = cur.lastrowid
    conn.commit()
    conn.close()

    log_action("motivation_added", f"Motivation added: {name}")
    return mid


def update_motivation(motivation_id, name, motivation_type, config_json, description=None, is_active=1):
    json.loads(config_json)
    motivation_type = motivation_type or "composite"

    conn = get_db_connection()
    conn.execute(
        """
        UPDATE motivations
        SET name = ?, motivation_type = ?, config_json = ?, description = ?, is_active = ?
        WHERE id = ? AND is_deleted = 0
        """,
        (name, motivation_type, config_json, description, is_active, motivation_id)
    )
    conn.commit()
    conn.close()

    log_action("motivation_updated", f"Motivation updated: {motivation_id}")
    return True


# =========================
# TRASH (SOFT DELETE)
# =========================

def soft_delete_motivation(motivation_id):
    conn = get_db_connection()
    conn.execute(
        """
        UPDATE motivations
        SET is_deleted = 1, deleted_at = ?
        WHERE id = ?
        """,
        (datetime.now().isoformat(), motivation_id)
    )
    conn.commit()
    conn.close()

    log_action("motivation_soft_deleted", f"Motivation moved to trash: {motivation_id}")
    return True


def restore_motivation(motivation_id):
    conn = get_db_connection()
    conn.execute(
        """
        UPDATE motivations
        SET is_deleted = 0, deleted_at = NULL
        WHERE id = ?
        """,
        (motivation_id,)
    )
    conn.commit()
    conn.close()

    log_action("motivation_restored", f"Motivation restored: {motivation_id}")
    return True


def delete_motivation_forever(motivation_id):
    conn = get_db_connection()
    conn.execute(
        "DELETE FROM motivations WHERE id = ?",
        (motivation_id,),
    )
    conn.commit()
    conn.close()
    log_action("motivation_deleted", f"Motivation permanently deleted: {motivation_id}")
    return True
