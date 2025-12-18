from config import get_db_connection, log_action
from datetime import datetime

# =========================
# CREATE PAYMENT (SAFE)
# =========================

def create_payment(
    operator_id,
    calculation_date,
    total_salary,
    period_start=None,
    period_end=None,
    sales_amount=0
):
    conn = get_db_connection()

    existing = conn.execute(
        '''
        SELECT id FROM payments
        WHERE operator_id = ?
          AND calculation_date = ?
          AND is_deleted = 0
        ''',
        (operator_id, calculation_date)
    ).fetchone()

    if existing:
        conn.close()
        return existing['id']

    cursor = conn.cursor()
    cursor.execute(
        '''
        INSERT INTO payments
        (operator_id, calculation_date, total_salary, is_paid,
         period_start, period_end, sales_amount)
        VALUES (?, ?, ?, 0, ?, ?, ?)
        ''',
        (
            operator_id,
            calculation_date,
            total_salary,
            period_start,
            period_end,
            sales_amount
        )
    )

    payment_id = cursor.lastrowid
    conn.commit()
    conn.close()

    log_action(
        'payment_created',
        f'Payment created: {total_salary}',
        operator_id
    )

    return payment_id


# =========================
# READ PAYMENTS (SAFE)
# =========================

def get_payments(operator_id=None, start_date=None, end_date=None, include_deleted=False):
    conn = get_db_connection()

    query = '''
        SELECT p.*, o.name AS operator_name
        FROM payments p
        LEFT JOIN operators o ON p.operator_id = o.id
        WHERE 1 = 1
    '''
    params = []

    if not include_deleted:
        query += ' AND p.is_deleted = 0'

    if operator_id:
        query += ' AND p.operator_id = ?'
        params.append(operator_id)

    if start_date:
        query += ' AND p.calculation_date >= ?'
        params.append(start_date)

    if end_date:
        query += ' AND p.calculation_date <= ?'
        params.append(end_date)

    query += ' ORDER BY p.calculation_date DESC'

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return rows


# =========================
# UPDATE PAYMENT STATUS
# =========================

def update_payment_status(payment_id, is_paid):
    conn = get_db_connection()

    payment_date = datetime.now().strftime('%Y-%m-%d') if is_paid else None

    conn.execute(
        '''
        UPDATE payments
        SET is_paid = ?, payment_date = ?
        WHERE id = ? AND is_deleted = 0
        ''',
        (1 if is_paid else 0, payment_date, payment_id)
    )

    conn.commit()
    conn.close()

    status_text = 'paid' if is_paid else 'pending'
    log_action(
        'payment_status_updated',
        f'Payment {payment_id} status: {status_text}'
    )


# =========================
# SOFT DELETE / RESTORE
# =========================

def soft_delete_payment(payment_id):
    conn = get_db_connection()
    conn.execute(
        '''
        UPDATE payments
        SET is_deleted = 1,
            deleted_at = ?
        WHERE id = ?
        ''',
        (datetime.now().isoformat(), payment_id)
    )
    conn.commit()
    conn.close()

    log_action(
        'payment_soft_deleted',
        f'Payment moved to trash: {payment_id}'
    )


def restore_payment(payment_id):
    conn = get_db_connection()
    conn.execute(
        '''
        UPDATE payments
        SET is_deleted = 0,
            deleted_at = NULL
        WHERE id = ?
        ''',
        (payment_id,)
    )
    conn.commit()
    conn.close()

    log_action(
        'payment_restored',
        f'Payment restored from trash: {payment_id}'
    )


def get_deleted_payments():
    conn = get_db_connection()
    rows = conn.execute(
        'SELECT * FROM payments WHERE is_deleted = 1 ORDER BY deleted_at DESC'
    ).fetchall()
    conn.close()
    return rows


def delete_payment_forever(payment_id):
    conn = get_db_connection()
    conn.execute(
        'DELETE FROM payments WHERE id = ?',
        (payment_id,),
    )
    conn.commit()
    conn.close()
    log_action('payment_deleted', f'Payment permanently deleted: {payment_id}')
    return True


# =========================
# STATISTICS (SAFE)
# =========================

def get_payment_statistics(start_date=None, end_date=None):
    conn = get_db_connection()

    query = '''
        SELECT
            COUNT(*) AS total_payments,
            SUM(total_salary) AS total_amount,
            SUM(CASE WHEN is_paid = 1 THEN total_salary ELSE 0 END) AS paid_amount,
            SUM(CASE WHEN is_paid = 0 THEN total_salary ELSE 0 END) AS pending_amount,
            COUNT(CASE WHEN is_paid = 1 THEN 1 END) AS paid_count,
            COUNT(CASE WHEN is_paid = 0 THEN 1 END) AS pending_count
        FROM payments
        WHERE is_deleted = 0
    '''
    params = []

    if start_date:
        query += ' AND calculation_date >= ?'
        params.append(start_date)

    if end_date:
        query += ' AND calculation_date <= ?'
        params.append(end_date)

    stats = conn.execute(query, params).fetchone()
    conn.close()

    return dict(stats) if stats else {}
