from config import get_db_connection, log_action
from datetime import datetime

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
