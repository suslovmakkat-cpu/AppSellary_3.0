import json
from datetime import datetime

from config import get_db_connection, log_action
from motivation_engine import MotivationEngine, derive_amounts

def ensure_calculation_columns(conn):
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(manual_calculations)").fetchall()}
    required = {
        "period_start": "TEXT",
        "period_end": "TEXT",
        "additional_bonus": "REAL DEFAULT 0",
        "penalty_amount": "REAL DEFAULT 0",
        "comment": "TEXT",
        "is_deleted": "INTEGER DEFAULT 0",
        "deleted_at": "TEXT",
        "redemption_percent": "REAL DEFAULT 0",
        "manual_fixed_bonus": "REAL DEFAULT 0",
        "manual_penalty": "REAL DEFAULT 0",
        "bonus_percent_salary": "REAL DEFAULT 0",
        "bonus_percent_sales": "REAL DEFAULT 0",
        "applied_motivation_id": "INTEGER",
        "applied_motivation_name": "TEXT",
        "motivation_snapshot": "TEXT",
        "calculation_breakdown": "TEXT",
        "working_days_in_period": "REAL DEFAULT 0",
        "plan_target": "REAL DEFAULT 0",
        "plan_completion": "REAL DEFAULT 0",
    }
    for col, ddl in required.items():
        if col not in columns:
            conn.execute(f"ALTER TABLE manual_calculations ADD COLUMN {col} {ddl}")



def calculate_salary(
    operator_id,
    kc_amount,
    non_kc_amount,
    sales_amount,
    redemption_percent=None,
    period_start=None,
    period_end=None,
    working_days_in_period=0,
    additional_bonus=0,
    penalty_amount=0,
    comment=None,
    save_to_db=True,
    motivation_override_id=None,
    bonus_percent_salary=0,
    bonus_percent_sales=0,
):
    conn = get_db_connection()
    ensure_calculation_columns(conn)

    operator = conn.execute(
        """
        SELECT
            o.id AS operator_id,
            o.name AS operator_name,
            o.salary_type AS salary_type,
            o.base_percent AS base_percent,
            o.tax_bonus AS tax_bonus,
            o.motivation_id AS operator_motivation_id,
            m.id AS motivation_id,
            m.name AS motivation_name,
            m.motivation_type AS motivation_type,
            m.config_json AS config_json,
            m.is_active AS motivation_is_active,
            m.is_deleted AS motivation_is_deleted
        FROM operators o
        LEFT JOIN motivations m ON m.id = o.motivation_id
        WHERE o.id = ? AND o.is_deleted = 0
        """,
        (operator_id,),
    ).fetchone()

    if not operator:
        conn.close()
        return None

    target_motivation_id = motivation_override_id or operator["operator_motivation_id"]
    motivation = None
    if target_motivation_id:
        motivation = conn.execute(
            "SELECT * FROM motivations WHERE id = ?",
            (target_motivation_id,),
        ).fetchone()

    kc_value, non_kc_value, sales_value, redemption_percent = derive_amounts(
        kc_amount, non_kc_amount, sales_amount, redemption_percent
    )

    config = {}
    applied_motivation_name = None
    if motivation and int(motivation["is_deleted"]) == 0 and int(motivation["is_active"]) == 1:
        applied_motivation_name = motivation["name"]
        config = MotivationEngine.parse_config(motivation["config_json"])

    motivation_result = MotivationEngine.calculate_components(
        config=config,
        kc_amount=kc_value,
        sales_amount=sales_value,
        redemption_percent=redemption_percent,
        working_days_in_period=working_days_in_period,
    )

    kc_percent = motivation_result.kc_percent
    kc_salary_component = motivation_result.redemption_component

    subtotal = 0.0
    subtotal += motivation_result.base_salary
    subtotal += motivation_result.sales_component
    subtotal += motivation_result.redemption_component
    subtotal += motivation_result.fixed_bonuses

    manual_bonus = float(additional_bonus or 0)
    manual_penalty = float(penalty_amount or 0)
    subtotal += manual_bonus
    subtotal -= manual_penalty

    subtotal *= motivation_result.plan_multiplier

    config_percent_bonus = motivation_result.percentage_bonus_value
    percent_bonus_amount = subtotal * (config_percent_bonus / 100.0)
    subtotal += percent_bonus_amount

    bonus_from_salary = subtotal * (float(bonus_percent_salary or 0) / 100.0)
    bonus_from_sales = sales_value * (float(bonus_percent_sales or 0) / 100.0)
    subtotal += bonus_from_salary + bonus_from_sales

    motivation_tax_bonus = subtotal * (float(motivation_result.tax_bonus_percent) / 100.0)
    subtotal += motivation_tax_bonus

    tax_bonus_percent = float(operator["tax_bonus"] or 0)
    salary_type = operator["salary_type"]
    tax_bonus = subtotal * (tax_bonus_percent / 100.0) if tax_bonus_percent > 0 and salary_type else 0
    total_salary = subtotal + tax_bonus

    breakdown = {
        "kc_salary": motivation_result.redemption_component,
        "motivation_base_salary": motivation_result.base_salary,
        "sales_component": motivation_result.sales_component,
        "redemption_component": motivation_result.redemption_component,
        "config_bonuses": motivation_result.fixed_bonuses,
        "config_percent_bonus": percent_bonus_amount,
        "manual_bonus": manual_bonus,
        "manual_penalty": manual_penalty,
        "bonus_from_salary": bonus_from_salary,
        "bonus_from_sales": bonus_from_sales,
        "motivation_tax_bonus": motivation_tax_bonus,
        "tax_bonus": tax_bonus,
        "plan_target": motivation_result.plan_target,
        "plan_completion": motivation_result.plan_completion,
    }

    if save_to_db:
        conn.execute(
            """
            INSERT INTO manual_calculations
            (operator_id, kc_amount, non_kc_amount, kc_percent, sales_amount, total_salary,
             period_start, period_end, additional_bonus, penalty_amount, comment,
             redemption_percent, manual_fixed_bonus, manual_penalty, bonus_percent_salary,
             bonus_percent_sales, applied_motivation_id, applied_motivation_name,
             motivation_snapshot, calculation_breakdown, working_days_in_period,
             plan_target, plan_completion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                operator_id,
                kc_value,
                non_kc_value,
                kc_percent,
                sales_value,
                total_salary,
                period_start,
                period_end,
                manual_bonus,
                manual_penalty,
                comment,
                redemption_percent,
                manual_bonus,
                manual_penalty,
                bonus_percent_salary,
                bonus_percent_sales,
                target_motivation_id,
                applied_motivation_name,
                json.dumps(config),
                json.dumps(breakdown),
                working_days_in_period,
                motivation_result.plan_target,
                motivation_result.plan_completion,
            ),
        )
        conn.commit()
        log_action("calculation_created", f"calc for operator {operator_id}", operator_id)

    conn.close()

    return {
        "kc_salary": kc_salary_component,
        "non_kc_salary": non_kc_value,
        "additional_bonus": manual_bonus,
        "penalty_amount": manual_penalty,
        "tax_bonus": tax_bonus,
        "total_salary": total_salary,
        "kc_percent": kc_percent,
        "redemption_percent": redemption_percent,
        "derived_sales": sales_value,
        "derived_non_kc": non_kc_value,
        "applied_motivation": applied_motivation_name,
        "motivation_tax_bonus": motivation_tax_bonus,
        "plan_target": motivation_result.plan_target,
        "plan_completion": motivation_result.plan_completion,
    }


def get_calculations_with_filters(operator_id=None, start_date=None, end_date=None, limit=None):
    conn = get_db_connection()
    ensure_calculation_columns(conn)

    query = """
        SELECT mc.*, o.name as operator_name
        FROM manual_calculations mc
        LEFT JOIN operators o ON mc.operator_id = o.id
        WHERE 1=1
    """
    params = []

    try:
        conn.execute("SELECT is_deleted FROM manual_calculations LIMIT 1").fetchone()
        query += " AND mc.is_deleted = 0"
    except Exception:
        pass

    if operator_id:
        query += " AND mc.operator_id = ?"
        params.append(operator_id)

    if start_date:
        query += " AND mc.calculation_date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND mc.calculation_date <= ?"
        params.append(end_date)
    query += " ORDER BY mc.calculation_date DESC"

    if limit:
        query += " LIMIT ?"
        params.append(limit)

    rows = conn.execute(query, params).fetchall()
    conn.close()

    return [dict(r) for r in rows]
