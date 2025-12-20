import json
from datetime import datetime

from config import get_db_connection, log_action
from motivation_engine import MotivationEngine, derive_amounts


def _fmt_money(value: float) -> str:
    return f"{value:,.2f}".replace(",", " ")

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
        "include_redemption_percent": "INTEGER DEFAULT 1",
        "correction_date": "TEXT",
    }
    for col, ddl in required.items():
        if col not in columns:
            conn.execute(f"ALTER TABLE manual_calculations ADD COLUMN {col} {ddl}")



def _calculate_components(
    operator,
    motivation,
    kc_amount,
    non_kc_amount,
    sales_amount,
    redemption_percent,
    working_days_in_period,
    additional_bonus,
    penalty_amount,
    bonus_percent_salary,
    bonus_percent_sales,
    include_redemption_percent=True,
):
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
    subtotal = 0.0
    steps = []

    steps.append(
        "Исходные данные: выкупленные заказы {kc} руб., невыкупленные {non_kc} руб., общая сумма продаж {sales} руб., процент выкупа {percent:.1f}%".format(
            kc=_fmt_money(kc_value),
            non_kc=_fmt_money(non_kc_value),
            sales=_fmt_money(sales_value),
            percent=redemption_percent,
        )
    )

    if motivation_result.base_salary:
        prev = subtotal
        subtotal += motivation_result.base_salary
        steps.append(
            f"Базовая часть мотивации: фиксированная сумма {_fmt_money(motivation_result.base_salary)} руб. Сумма была {prev:.2f} руб., стала {subtotal:.2f} руб."
        )

    sales_percent_value = (motivation_result.sales_component / sales_value * 100.0) if sales_value else 0.0
    if motivation_result.sales_component:
        prev = subtotal
        subtotal += motivation_result.sales_component
        steps.append(
            "Процент с продаж: база {base} руб., ставка {percent:.2f}%. Формула: {base} × {percent:.2f}% = {delta} руб. Сумма была {prev:.2f} руб., стала {after:.2f} руб.".format(
                base=_fmt_money(sales_value),
                percent=sales_percent_value,
                delta=_fmt_money(motivation_result.sales_component),
                prev=prev,
                after=subtotal,
            )
        )

    redemption_component_value = motivation_result.redemption_component if include_redemption_percent else 0.0
    if redemption_component_value:
        prev = subtotal
        subtotal += redemption_component_value
        steps.append(
            "Процент с выкупа: база {base} руб., ставка {percent:.2f}%. Формула: {base} × {percent:.2f}% = {delta} руб. Сумма была {prev:.2f} руб., стала {after:.2f} руб.".format(
                base=_fmt_money(kc_value),
                percent=motivation_result.kc_percent,
                delta=_fmt_money(redemption_component_value),
                prev=prev,
                after=subtotal,
            )
        )
    elif motivation_result.redemption_component:
        steps.append("Процент с выкупа отключен для расчета")

    if motivation_result.fixed_bonuses:
        prev = subtotal
        subtotal += motivation_result.fixed_bonuses
        steps.append(
            f"Фиксированные бонусы мотивации: +{_fmt_money(motivation_result.fixed_bonuses)} руб. Сумма была {prev:.2f} руб., стала {subtotal:.2f} руб."
        )

    manual_bonus = float(additional_bonus or 0)
    manual_penalty = float(penalty_amount or 0)
    if manual_bonus:
        prev = subtotal
        subtotal += manual_bonus
        steps.append(
            f"Ручной фиксированный бонус: +{_fmt_money(manual_bonus)} руб. Сумма была {prev:.2f} руб., стала {subtotal:.2f} руб."
        )
    if manual_penalty:
        prev = subtotal
        subtotal -= manual_penalty
        steps.append(
            f"Штраф: -{_fmt_money(manual_penalty)} руб. Сумма была {prev:.2f} руб., стала {subtotal:.2f} руб."
        )

    if motivation_result.plan_multiplier != 1:
        prev = subtotal
        subtotal *= motivation_result.plan_multiplier
        steps.append(
            f"Множитель выполнения плана ({motivation_result.plan_multiplier:.2f}): {prev:.2f} руб. → {subtotal:.2f} руб. (план {motivation_result.plan_target:.2f}, выполнение {(motivation_result.plan_completion * 100):.1f}% )"
        )

    config_percent_bonus = motivation_result.percentage_bonus_value
    percent_bonus_amount = subtotal * (config_percent_bonus / 100.0)
    if percent_bonus_amount:
        prev = subtotal
        subtotal += percent_bonus_amount
        steps.append(
            "Процентный бонус мотивации: база {base} руб., ставка {percent:.2f}%. Формула: {base} × {percent:.2f}% = {delta} руб. Сумма была {prev:.2f} руб., стала {after:.2f} руб.".format(
                base=_fmt_money(prev),
                percent=config_percent_bonus,
                delta=_fmt_money(percent_bonus_amount),
                prev=prev,
                after=subtotal,
            )
        )

    bonus_from_salary = subtotal * (float(bonus_percent_salary or 0) / 100.0)
    bonus_from_sales = sales_value * (float(bonus_percent_sales or 0) / 100.0)
    if bonus_from_salary or bonus_from_sales:
        prev = subtotal
        subtotal += bonus_from_salary + bonus_from_sales
        details = []
        if bonus_from_salary:
            details.append(
                "от расчета: {base} × {percent:.2f}% = {delta} руб.".format(
                    base=_fmt_money(prev),
                    percent=float(bonus_percent_salary or 0),
                    delta=_fmt_money(bonus_from_salary),
                )
            )
        if bonus_from_sales:
            details.append(
                "от продаж: {base} × {percent:.2f}% = {delta} руб.".format(
                    base=_fmt_money(sales_value),
                    percent=float(bonus_percent_sales or 0),
                    delta=_fmt_money(bonus_from_sales),
                )
            )
        steps.append(
            f"Дополнительные бонусы ({'; '.join(details)}). Сумма была {prev:.2f} руб., стала {subtotal:.2f} руб."
        )

    tax_bonus_percent = float(operator["tax_bonus"] or 0)
    tax_bonus = subtotal * (tax_bonus_percent / 100.0) if tax_bonus_percent > 0 else 0
    total_salary = subtotal + tax_bonus
    if tax_bonus:
        pre_tax = subtotal
        steps.append(
            "Надбавка оператора за налог: база {base} руб., ставка {percent:.2f}%. Формула: {base} × {percent:.2f}% = {delta} руб. Сумма была {prev:.2f} руб., стала {after:.2f} руб.".format(
                base=_fmt_money(pre_tax),
                percent=tax_bonus_percent,
                delta=_fmt_money(tax_bonus),
                prev=pre_tax,
                after=total_salary,
            )
        )

    steps.append(f"Итоговая выплата: {_fmt_money(total_salary)} руб.")

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
        "tax_bonus": tax_bonus,
        "plan_target": motivation_result.plan_target,
        "plan_completion": motivation_result.plan_completion,
        "detailed_steps": steps,
    }

    return {
        "kc_salary": redemption_component_value,
        "non_kc_salary": non_kc_value,
        "additional_bonus": manual_bonus,
        "penalty_amount": manual_penalty,
        "tax_bonus": tax_bonus,
        "total_salary": total_salary,
        "kc_percent": kc_percent,
        "redemption_percent": redemption_percent,
        "derived_kc": kc_value,
        "derived_sales": sales_value,
        "derived_non_kc": non_kc_value,
        "applied_motivation": applied_motivation_name,
        "motivation_tax_bonus": 0.0,
        "plan_target": motivation_result.plan_target,
        "plan_completion": motivation_result.plan_completion,
        "applied_motivation_name": applied_motivation_name,
        "applied_motivation_config": config,
        "detailed_breakdown": steps,
        "include_redemption_percent": 1 if include_redemption_percent else 0,
    }, breakdown


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
    include_redemption_percent=True,
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

    calc_result, breakdown = _calculate_components(
        operator,
        motivation,
        kc_amount,
        non_kc_amount,
        sales_amount,
        redemption_percent,
        working_days_in_period,
        additional_bonus,
        penalty_amount,
        bonus_percent_salary,
        bonus_percent_sales,
        include_redemption_percent,
    )

    if save_to_db:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO manual_calculations
            (operator_id, kc_amount, non_kc_amount, kc_percent, sales_amount, total_salary,
             period_start, period_end, additional_bonus, penalty_amount, comment,
             redemption_percent, manual_fixed_bonus, manual_penalty, bonus_percent_salary,
             bonus_percent_sales, applied_motivation_id, applied_motivation_name,
             motivation_snapshot, calculation_breakdown, working_days_in_period,
             plan_target, plan_completion, include_redemption_percent, correction_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                operator_id,
                calc_result["derived_kc"],
                calc_result["derived_non_kc"],
                calc_result["kc_percent"],
                calc_result["derived_sales"],
                calc_result["total_salary"],
                period_start,
                period_end,
                calc_result["additional_bonus"],
                calc_result["penalty_amount"],
                comment,
                calc_result["redemption_percent"],
                calc_result["additional_bonus"],
                calc_result["penalty_amount"],
                bonus_percent_salary,
                bonus_percent_sales,
                target_motivation_id,
                calc_result["applied_motivation"],
                json.dumps(calc_result["applied_motivation_config"]),
                json.dumps(breakdown),
                working_days_in_period,
                calc_result["plan_target"],
                calc_result["plan_completion"],
                1 if include_redemption_percent else 0,
                None,
            ),
        )
        calc_id = cur.lastrowid
        conn.commit()
        calc_row = conn.execute(
            "SELECT calculation_date, correction_date FROM manual_calculations WHERE id = ?",
            (calc_id,),
        ).fetchone()
        log_action("calculation_created", f"calc for operator {operator_id}", operator_id)
    else:
        calc_id = None
        calc_row = None

    conn.close()

    calc_result["calculation_id"] = calc_id
    if calc_row:
        calc_result["calculation_date"] = calc_row["calculation_date"]
        calc_result["correction_date"] = calc_row["correction_date"]
    return calc_result


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


def update_calculation(
    calculation_id,
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
    motivation_override_id=None,
    bonus_percent_salary=0,
    bonus_percent_sales=0,
    include_redemption_percent=None,
    from_correction=False,
):
    conn = get_db_connection()
    ensure_calculation_columns(conn)

    existing = conn.execute(
        "SELECT * FROM manual_calculations WHERE id = ?", (calculation_id,)
    ).fetchone()
    if not existing:
        conn.close()
        return None

    include_flag = include_redemption_percent if include_redemption_percent is not None else bool(existing.get("include_redemption_percent", 1))

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

    calc_result, breakdown = _calculate_components(
        operator,
        motivation,
        kc_amount,
        non_kc_amount,
        sales_amount,
        redemption_percent,
        working_days_in_period,
        additional_bonus,
        penalty_amount,
        bonus_percent_salary,
        bonus_percent_sales,
        include_flag,
    )

    conn.execute(
        """
        UPDATE manual_calculations
        SET operator_id = ?, kc_amount = ?, non_kc_amount = ?, kc_percent = ?, sales_amount = ?, total_salary = ?,
            period_start = ?, period_end = ?, additional_bonus = ?, penalty_amount = ?, comment = ?,
            redemption_percent = ?, manual_fixed_bonus = ?, manual_penalty = ?, bonus_percent_salary = ?,
            bonus_percent_sales = ?, applied_motivation_id = ?, applied_motivation_name = ?,
            motivation_snapshot = ?, calculation_breakdown = ?, working_days_in_period = ?, plan_target = ?, plan_completion = ?,
            include_redemption_percent = ?, correction_date = ?
        WHERE id = ?
        """,
        (
            operator_id,
            calc_result["derived_kc"],
            calc_result["derived_non_kc"],
            calc_result["kc_percent"],
            calc_result["derived_sales"],
            calc_result["total_salary"],
            period_start,
            period_end,
            calc_result["additional_bonus"],
            calc_result["penalty_amount"],
            comment,
            calc_result["redemption_percent"],
            calc_result["additional_bonus"],
            calc_result["penalty_amount"],
            bonus_percent_salary,
            bonus_percent_sales,
            target_motivation_id,
            calc_result["applied_motivation"],
            json.dumps(calc_result["applied_motivation_config"]),
            json.dumps(breakdown),
            working_days_in_period,
            calc_result["plan_target"],
            calc_result["plan_completion"],
            1 if include_flag else 0,
            datetime.now().strftime("%Y-%m-%d") if from_correction else existing["correction_date"],
            calculation_id,
        ),
    )

    payment_row = conn.execute(
        """
        SELECT id FROM payments
        WHERE is_deleted = 0 AND (calculation_id = ? OR (operator_id = ? AND calculation_date = ?))
        ORDER BY CASE WHEN calculation_id = ? THEN 0 ELSE 1 END
        LIMIT 1
        """,
        (calculation_id, existing["operator_id"], existing["calculation_date"], calculation_id),
    ).fetchone()

    if payment_row:
        conn.execute(
            """
            UPDATE payments
            SET operator_id = ?, total_salary = ?, period_start = ?, period_end = ?, sales_amount = ?, calculation_id = ?, correction_date = CASE WHEN ? THEN ? ELSE correction_date END
            WHERE id = ?
            """,
            (
                operator_id,
                calc_result["total_salary"],
                period_start,
                period_end,
                calc_result["derived_sales"],
                calculation_id,
                1 if from_correction else 0,
                datetime.now().strftime("%Y-%m-%d") if from_correction else None,
                payment_row["id"],
            ),
        )
    else:
        conn.execute(
            """
            INSERT INTO payments
            (operator_id, calculation_date, total_salary, is_paid, period_start, period_end, sales_amount, calculation_id, correction_date)
            VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)
            """,
            (
                operator_id,
                existing["calculation_date"],
                calc_result["total_salary"],
                period_start,
                period_end,
                calc_result["derived_sales"],
                calculation_id,
                datetime.now().strftime("%Y-%m-%d") if from_correction else None,
            ),
        )

    conn.commit()
    conn.close()

    log_action("calculation_updated", f"calc #{calculation_id} updated", operator_id)
    return calc_result
