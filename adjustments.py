from config import get_db_connection, log_action
from datetime import datetime
from calculations import update_calculation
from payments import update_payment

# ============================================================
# EXISTING LOGIC (UNCHANGED)
# ============================================================

def adjust_redemption_percent(calculation_id, new_kc_percent):
    conn = get_db_connection()
    
    calculation = conn.execute(
        'SELECT * FROM manual_calculations WHERE id = ?', (calculation_id,)
    ).fetchone()
    
    if not calculation:
        return False
    
    kc_salary = (calculation['kc_amount'] * new_kc_percent / 100)
    total_salary = kc_salary + calculation['non_kc_amount']
    
    conn.execute(
        'UPDATE manual_calculations SET kc_percent = ?, total_salary = ? WHERE id = ?',
        (new_kc_percent, total_salary, calculation_id)
    )
    
    conn.commit()
    conn.close()
    
    log_action(
        'redemption_adjusted',
        f'Redemption percent adjusted: {calculation["kc_percent"]} -> {new_kc_percent}',
        calculation['operator_id']
    )
    return True


def mass_adjust_payments(operator_ids, adjustment_type, adjustment_value):
    conn = get_db_connection()
    
    for operator_id in operator_ids:
        if adjustment_type == 'tax_bonus':
            conn.execute(
                'UPDATE operators SET tax_bonus = ? WHERE id = ?',
                (adjustment_value, operator_id)
            )
            log_action(
                'mass_tax_adjustment',
                f'Mass tax bonus adjustment: {adjustment_value}',
                operator_id
            )
        elif adjustment_type == 'base_percent':
            conn.execute(
                'UPDATE operators SET base_percent = ? WHERE id = ?',
                (adjustment_value, operator_id)
            )
            log_action(
                'mass_percent_adjustment',
                f'Mass base percent adjustment: {adjustment_value}',
                operator_id
            )
    
    conn.commit()
    conn.close()
    return True


# =========================
# CORRECTION HELPERS
# =========================


def list_corrections():
    conn = get_db_connection()
    rows = conn.execute(
        '''
        SELECT mc.*, o.name AS operator_name,
               p.id AS payment_id,
               p.total_salary AS payment_total,
               p.correction_date AS payment_correction_date,
               p.period_start AS payment_period_start,
               p.period_end AS payment_period_end
        FROM manual_calculations mc
        LEFT JOIN operators o ON o.id = mc.operator_id
        LEFT JOIN payments p ON p.operator_id = mc.operator_id
             AND IFNULL(p.period_start,'') = IFNULL(mc.period_start,'')
             AND IFNULL(p.period_end,'') = IFNULL(mc.period_end,'')
             AND p.is_deleted = 0
        WHERE mc.is_deleted = 0
        ORDER BY mc.calculation_date DESC
        '''
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_correction(calculation_id):
    conn = get_db_connection()
    row = conn.execute(
        '''
        SELECT mc.*, o.name AS operator_name,
               p.id AS payment_id,
               p.total_salary AS payment_total,
               p.correction_date AS payment_correction_date,
               p.period_start AS payment_period_start,
               p.period_end AS payment_period_end
        FROM manual_calculations mc
        LEFT JOIN operators o ON o.id = mc.operator_id
        LEFT JOIN payments p ON p.operator_id = mc.operator_id
             AND IFNULL(p.period_start,'') = IFNULL(mc.period_start,'')
             AND IFNULL(p.period_end,'') = IFNULL(mc.period_end,'')
             AND p.is_deleted = 0
        WHERE mc.id = ? AND mc.is_deleted = 0
        '''
        , (calculation_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def apply_correction(calculation_id, payload):
    base_conn = get_db_connection()
    existing = base_conn.execute(
        'SELECT * FROM manual_calculations WHERE id = ? AND is_deleted = 0',
        (calculation_id,)
    ).fetchone()
    base_conn.close()

    if not existing:
        return None

    now = datetime.now().isoformat()
    operator_id = payload.get('operator_id') or existing['operator_id']
    kc_amount = payload.get('kc_amount', existing['kc_amount'])
    non_kc_amount = payload.get('non_kc_amount', existing['non_kc_amount'])
    sales_amount = payload.get('sales_amount', existing['sales_amount'])
    redemption_percent = payload.get('redemption_percent', existing['redemption_percent'])
    period_start = payload.get('period_start', existing['period_start'])
    period_end = payload.get('period_end', existing['period_end'])
    working_days = payload.get('working_days_in_period', existing['working_days_in_period'])
    additional_bonus = payload.get('additional_bonus', existing['additional_bonus'])
    penalty_amount = payload.get('penalty_amount', existing['penalty_amount'])
    comment = payload.get('comment', existing['comment'])
    include_buyout = payload.get('include_buyout_percent', existing.get('include_buyout_percent', 1))
    payment_id = payload.get('payment_id')

    result = update_calculation(
        calculation_id,
        operator_id,
        kc_amount,
        non_kc_amount,
        sales_amount,
        redemption_percent,
        period_start,
        period_end,
        working_days,
        additional_bonus,
        penalty_amount,
        comment,
        payload.get('motivation_override_id'),
        payload.get('bonus_percent_salary', existing['bonus_percent_salary']),
        payload.get('bonus_percent_sales', existing['bonus_percent_sales']),
        include_buyout,
        now,
        payment_id,
    )

    if not result:
        return None

    if payment_id:
        update_payment(
            payment_id,
            total_salary=result['total_salary'],
            period_start=period_start,
            period_end=period_end,
            sales_amount=result.get('derived_sales', sales_amount),
            correction_date=now,
        )

    log_action('calculation_corrected', f'Calculation {calculation_id} corrected', operator_id)
    return result


# ============================================================
# NEW LOGIC (ADDED, SAFE)
# Soft delete / restore for calculations and payments
# ============================================================

def _now_iso():
    return datetime.now().isoformat(timespec="seconds")


def soft_delete_calculation(calculation_id):
    conn = get_db_connection()
    conn.execute(
        'UPDATE manual_calculations SET is_deleted = 1, deleted_at = ? WHERE id = ?',
        (_now_iso(), calculation_id)
    )
    conn.commit()
    conn.close()

    log_action(
        'calculation_soft_deleted',
        f'Calculation moved to trash: {calculation_id}'
    )
    return True


def restore_calculation(calculation_id):
    conn = get_db_connection()
    conn.execute(
        'UPDATE manual_calculations SET is_deleted = 0, deleted_at = NULL WHERE id = ?',
        (calculation_id,)
    )
    conn.commit()
    conn.close()

    log_action(
        'calculation_restored',
        f'Calculation restored from trash: {calculation_id}'
    )
    return True


def get_deleted_calculations():
    conn = get_db_connection()
    rows = conn.execute(
        'SELECT * FROM manual_calculations WHERE is_deleted = 1 ORDER BY deleted_at DESC'
    ).fetchall()
    conn.close()
    return rows


def delete_calculation_forever(calculation_id):
    conn = get_db_connection()
    conn.execute(
        'DELETE FROM manual_calculations WHERE id = ?',
        (calculation_id,),
    )
    conn.commit()
    conn.close()
    log_action('calculation_deleted', f'Calculation permanently deleted: {calculation_id}')
    return True


def soft_delete_payment(payment_id):
    conn = get_db_connection()
    conn.execute(
        'UPDATE payments SET is_deleted = 1, deleted_at = ? WHERE id = ?',
        (_now_iso(), payment_id)
    )
    conn.commit()
    conn.close()

    log_action(
        'payment_soft_deleted',
        f'Payment moved to trash: {payment_id}'
    )
    return True


def restore_payment(payment_id):
    conn = get_db_connection()
    conn.execute(
        'UPDATE payments SET is_deleted = 0, deleted_at = NULL WHERE id = ?',
        (payment_id,)
    )
    conn.commit()
    conn.close()

    log_action(
        'payment_restored',
        f'Payment restored from trash: {payment_id}'
    )
    return True
