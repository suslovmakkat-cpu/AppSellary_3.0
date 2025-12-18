import sqlite3

def final_check():
    conn = sqlite3.connect('operators.db')
    cursor = conn.cursor()
    
    print("=== ФИНАЛЬНЫЙ РЕЗУЛЬТАТ ===")
    
    # Операторы
    operators = cursor.execute('SELECT COUNT(*) FROM operators').fetchone()[0]
    print(f"✅ Операторов: {operators}")
    
    print("\\n👥 СПИСОК ОПЕРАТОРОВ:")
    ops = cursor.execute('SELECT id, name, salary_type, base_percent FROM operators').fetchall()
    for op in ops:
        print(f"   {op[0]}. {op[1]} - {op[2]} ({op[3]}%)")
    
    # Расчеты
    calculations = cursor.execute('SELECT COUNT(*) FROM manual_calculations').fetchone()[0]
    print(f"✅ Расчетов: {calculations}")
    
    # Выплаты
    payments = cursor.execute('SELECT COUNT(*) FROM payments').fetchone()[0]
    print(f"✅ Выплат: {payments}")
    
    conn.close()

final_check()
