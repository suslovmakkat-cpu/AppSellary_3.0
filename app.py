# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, send_from_directory
from datetime import datetime

from calculations import calculate_salary, get_calculations_with_filters, update_calculation
from operators import (
    get_all_operators, get_operator, add_operator, update_operator,
    soft_delete_operator, restore_operator, get_deleted_operators,
    delete_operator_forever
)
from payments import (
    create_payment, get_payments, update_payment_status,
    soft_delete_payment, restore_payment, get_deleted_payments,
    delete_payment_forever, update_payment
)
from adjustments import (
    adjust_redemption_percent, mass_adjust_payments,
    soft_delete_calculation, restore_calculation,
    get_deleted_calculations, delete_calculation_forever,
    list_corrections, get_correction, apply_correction
)
from motivations import (
    get_motivations, get_motivation,
    add_motivation, update_motivation,
    soft_delete_motivation, restore_motivation,
    get_deleted_motivations, delete_motivation_forever
)
from config import get_db_connection

app = Flask(__name__)

# =========================
# STATIC
# =========================

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# =========================
# OPERATORS
# =========================

@app.route('/api/operators', methods=['GET'])
def api_get_operators():
    conn = get_db_connection()
    rows = conn.execute(
        'SELECT * FROM operators WHERE is_deleted = 0 AND is_active = 1 ORDER BY name'
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/operators/<int:operator_id>', methods=['GET'])
def api_get_operator(operator_id):
    op = get_operator(operator_id)
    return jsonify(dict(op) if op else {})

@app.route('/api/operators', methods=['POST'])
def api_add_operator():
    data = request.json
    salary_type = data.get('salary_type') or None
    base_percent = data.get('base_percent')
    base_percent = None if base_percent in (None, 0, '') else base_percent
    tax_bonus = data.get('tax_bonus', 0) or 0
    oid = add_operator(
        data['name'],
        salary_type,
        base_percent,
        tax_bonus,
        data.get('motivation_id')
    )
    return jsonify({'id': oid})

@app.route('/api/operators/<int:operator_id>', methods=['PUT'])
def api_update_operator(operator_id):
    data = request.json
    salary_type = data.get('salary_type') or None
    base_percent = data.get('base_percent')
    base_percent = None if base_percent in (None, 0, '') else base_percent
    tax_bonus = data.get('tax_bonus', 0) or 0
    existing = get_operator(operator_id)
    update_operator(
        operator_id,
        data['name'],
        salary_type if 'salary_type' in data else existing.get('salary_type'),
        base_percent if 'base_percent' in data else existing.get('base_percent'),
        tax_bonus,
        data.get('is_active', existing.get('is_active', 1)),
        data.get('motivation_id', existing.get('motivation_id'))
    )
    return jsonify({'status': 'ok'})

# =========================
# CALCULATIONS
# =========================

@app.route('/api/calculate', methods=['POST'])
def api_calculate():
    data = request.get_json(silent=True) or {}
    if 'operator_id' not in data:
        return jsonify({'error': 'operator_id is required'}), 400
    try:
        result = calculate_salary(
            data['operator_id'],
            data.get('kc_amount', 0),
            data.get('non_kc_amount', 0),
            data.get('sales_amount', 0),
            data.get('redemption_percent'),
            data.get('period_start'),
            data.get('period_end'),
            data.get('working_days_in_period', 0),
            data.get('additional_bonus', 0),
            data.get('penalty_amount', 0),
            data.get('comment'),
            save_to_db=True,
            motivation_override_id=data.get('motivation_override_id'),
            bonus_percent_salary=data.get('bonus_percent_salary', 0),
            bonus_percent_sales=data.get('bonus_percent_sales', 0),
            include_buyout_percent=data.get('include_buyout_percent', True),
            correction_date=None,
        )
    except Exception as exc:
        return jsonify({'error': str(exc)}), 400

    if result:
        create_payment(
            data['operator_id'],
            datetime.now().strftime('%Y-%m-%d'),
            result['total_salary'],
            data.get('period_start'),
            data.get('period_end'),
            result.get('derived_sales', data.get('sales_amount', 0))
        )
    return jsonify(result or {'error': 'not found'})

@app.route('/api/calculations', methods=['GET'])
def api_calculations():
    return jsonify(get_calculations_with_filters(
        request.args.get('operator_id', type=int),
        request.args.get('start_date'),
        request.args.get('end_date'),
        request.args.get('limit', type=int)
    ))


@app.route('/api/calculations/<int:calc_id>', methods=['GET'])
def api_get_calculation(calc_id):
    conn = get_db_connection()
    row = conn.execute(
        'SELECT * FROM manual_calculations WHERE id = ?',
        (calc_id,),
    ).fetchone()
    conn.close()
    return jsonify(dict(row) if row else {})


@app.route('/api/calculations/<int:calc_id>', methods=['PUT'])
def api_update_calculation(calc_id):
    data = request.get_json(silent=True) or {}
    if 'operator_id' not in data:
        return jsonify({'error': 'operator_id is required'}), 400
    try:
        result = update_calculation(
            calc_id,
            data['operator_id'],
            data.get('kc_amount', 0),
            data.get('non_kc_amount', 0),
            data.get('sales_amount', 0),
            data.get('redemption_percent'),
            data.get('period_start'),
            data.get('period_end'),
            data.get('working_days_in_period', 0),
            data.get('additional_bonus', 0),
            data.get('penalty_amount', 0),
            data.get('comment'),
            data.get('motivation_override_id'),
            data.get('bonus_percent_salary', 0),
            data.get('bonus_percent_sales', 0),
            data.get('include_buyout_percent', True),
            data.get('correction_date')
        )
    except Exception as exc:
        return jsonify({'error': str(exc)}), 400

    if not result:
        return jsonify({'error': 'not found'}), 404

    return jsonify(result)

# =========================
# CORRECTIONS
# =========================


@app.route('/api/corrections', methods=['GET'])
def api_corrections():
    return jsonify(list_corrections())


@app.route('/api/corrections/<int:calc_id>', methods=['GET'])
def api_correction_get(calc_id):
    data = get_correction(calc_id)
    return jsonify(data or {})


@app.route('/api/corrections/<int:calc_id>', methods=['PUT'])
def api_correction_update(calc_id):
    data = request.get_json(silent=True) or {}
    result = apply_correction(calc_id, data)
    if not result:
        return jsonify({'error': 'not found'}), 404
    return jsonify(result)

# =========================
# PAYMENTS
# =========================

@app.route('/api/payments', methods=['GET'])
def api_payments():
    return jsonify([
        dict(p) for p in get_payments(
            request.args.get('operator_id', type=int),
            request.args.get('start_date'),
            request.args.get('end_date')
        )
    ])

@app.route('/api/payments/<int:pid>', methods=['PUT'])
def api_payment_update(pid):
    data = request.json or {}
    update_payment(
        pid,
        total_salary=data.get('total_salary'),
        period_start=data.get('period_start'),
        period_end=data.get('period_end'),
        sales_amount=data.get('sales_amount'),
        is_paid=data.get('is_paid'),
        payment_date=data.get('payment_date'),
        correction_date=data.get('correction_date')
    )
    return jsonify({'status': 'ok'})


@app.route('/api/payments/<int:pid>', methods=['GET'])
def api_payment_get(pid):
    conn = get_db_connection()
    row = conn.execute(
        'SELECT p.*, o.name as operator_name FROM payments p LEFT JOIN operators o ON p.operator_id = o.id WHERE p.id = ?',
        (pid,),
    ).fetchone()
    conn.close()
    return jsonify(dict(row) if row else {})

# =========================
# MOTIVATIONS (NEW)
# =========================

@app.route('/api/motivations', methods=['GET'])
def api_get_motivations():
    include_deleted = request.args.get('include_deleted', 'false').lower() == 'true'
    return jsonify(get_motivations(include_deleted=include_deleted))

@app.route('/api/motivations/<int:mid>', methods=['GET'])
def api_get_motivation(mid):
    return jsonify(get_motivation(mid))

@app.route('/api/motivations', methods=['POST'])
def api_add_motivation():
    d = request.json
    mid = add_motivation(
        d['name'],
        d['motivation_type'],
        d['config_json'],
        d.get('description')
    )
    return jsonify({'id': mid})

@app.route('/api/motivations/<int:mid>', methods=['PUT'])
def api_update_motivation(mid):
    d = request.json
    update_motivation(
        mid,
        d['name'],
        d['motivation_type'],
        d['config_json'],
        d.get('description'),
        d.get('is_active', 1)
    )
    return jsonify({'status': 'ok'})

# =========================
# TRASH (ALL)
# =========================

@app.route('/api/trash/operator/<int:i>', methods=['POST'])
def t_op(i): soft_delete_operator(i); return jsonify({'ok': True})

@app.route('/api/trash/operator/<int:i>/restore', methods=['POST'])
def r_op(i): restore_operator(i); return jsonify({'ok': True})

@app.route('/api/trash/calculation/<int:i>', methods=['POST'])
def t_calc(i): soft_delete_calculation(i); return jsonify({'ok': True})

@app.route('/api/trash/calculation/<int:i>/restore', methods=['POST'])
def r_calc(i): restore_calculation(i); return jsonify({'ok': True})

@app.route('/api/trash/payment/<int:i>', methods=['POST'])
def t_pay(i): soft_delete_payment(i); return jsonify({'ok': True})

@app.route('/api/trash/payment/<int:i>/restore', methods=['POST'])
def r_pay(i): restore_payment(i); return jsonify({'ok': True})

@app.route('/api/trash/motivation/<int:i>', methods=['POST'])
def t_mot(i): soft_delete_motivation(i); return jsonify({'ok': True})

@app.route('/api/trash/motivation/<int:i>/restore', methods=['POST'])
def r_mot(i): restore_motivation(i); return jsonify({'ok': True})


@app.route('/api/trash/summary', methods=['GET'])
def trash_summary():
    return jsonify({
        'operators': [dict(r) for r in get_deleted_operators()],
        'payments': [dict(r) for r in get_deleted_payments()],
        'calculations': [dict(r) for r in get_deleted_calculations()],
        'motivations': get_deleted_motivations(),
    })


@app.route('/api/trash/<string:entity>/<int:item_id>/delete', methods=['DELETE'])
def delete_permanently(entity, item_id):
    if entity == 'operator':
        delete_operator_forever(item_id)
    elif entity == 'payment':
        delete_payment_forever(item_id)
    elif entity == 'calculation':
        delete_calculation_forever(item_id)
    elif entity == 'motivation':
        delete_motivation_forever(item_id)
    else:
        return jsonify({'error': 'unknown entity'}), 400
    return jsonify({'ok': True})

# =========================
# RUN
# =========================

if __name__ == '__main__':
    app.run(debug=True, port=5000)
