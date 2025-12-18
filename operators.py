from config import get_db_connection, log_action
from datetime import datetime

# =========================
# READ OPERATORS (SAFE)
# =========================

def get_all_operators(include_deleted=False):
    conn = get_db_connection()

    query = '''
        SELECT * FROM operators
        WHERE 1 = 1
    '''
    params = []

    if not include_deleted:
        query += ' AND is_deleted = 0 AND is_active = 1'

    query += ' ORDER BY name'

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return rows


def get_deleted_operators():
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM operators WHERE is_deleted = 1 ORDER BY deleted_at DESC"
    ).fetchall()
    conn.close()
    return rows


def get_operator(operator_id):
    conn = get_db_connection()
    operator = conn.execute(
        'SELECT * FROM operators WHERE id = ?',
        (operator_id,)
    ).fetchone()
    conn.close()
    return operator


# =========================
# CREATE / UPDATE
# =========================

def add_operator(name, salary_type='progressive', base_percent=None, tax_bonus=0, motivation_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        '''
        INSERT INTO operators
        (name, salary_type, base_percent, tax_bonus, motivation_id)
        VALUES (?, ?, ?, ?, ?)
        ''',
        (name, salary_type, base_percent, tax_bonus, motivation_id)
    )

    operator_id = cursor.lastrowid
    conn.commit()
    conn.close()

    log_action(
        'operator_added',
        f'Operator added: {name}',
        operator_id
    )

    return operator_id


def update_operator(
    operator_id,
    name,
    salary_type,
    base_percent,
    tax_bonus,
    is_active,
    motivation_id=None
):
    conn = get_db_connection()

    conn.execute(
        '''
        UPDATE operators
        SET name = ?,
            salary_type = ?,
            base_percent = ?,
            tax_bonus = ?,
            is_active = ?,
            motivation_id = ?
        WHERE id = ? AND is_deleted = 0
        ''',
        (
            name,
            salary_type,
            base_percent,
            tax_bonus,
            is_active,
            motivation_id,
            operator_id
        )
    )

    conn.commit()
    conn.close()

    log_action(
        'operator_updated',
        f'Operator updated: {name}',
        operator_id
    )


# =========================
# SOFT DELETE / RESTORE
# =========================

def soft_delete_operator(operator_id):
    conn = get_db_connection()

    conn.execute(
        '''
        UPDATE operators
        SET is_deleted = 1,
            deleted_at = ?,
            is_active = 0
        WHERE id = ?
        ''',
        (datetime.now().isoformat(), operator_id)
    )

    conn.commit()
    conn.close()

    log_action(
        'operator_soft_deleted',
        f'Operator moved to trash',
        operator_id
    )


def restore_operator(operator_id):
    conn = get_db_connection()

    conn.execute(
        '''
        UPDATE operators
        SET is_deleted = 0,
            deleted_at = NULL,
            is_active = 1
        WHERE id = ?
        ''',
        (operator_id,)
    )

    conn.commit()
    conn.close()

    log_action(
        'operator_restored',
        f'Operator restored from trash',
        operator_id
    )


def delete_operator_forever(operator_id):
    conn = get_db_connection()
    conn.execute(
        'DELETE FROM operators WHERE id = ?',
        (operator_id,),
    )
    conn.commit()
    conn.close()
    log_action('operator_deleted', f'Operator permanently deleted', operator_id)
    return True
