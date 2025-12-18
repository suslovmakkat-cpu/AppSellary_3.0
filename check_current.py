import sqlite3

def check_current_state():
    conn = sqlite3.connect('operators.db')
    cursor = conn.cursor()
    
    print("=== ТЕКУЩЕЕ СОСТОЯНИЕ БАЗЫ ===")
    
    # Операторы
    operators = cursor.execute('SELECT COUNT(*) FROM operators').fetchone()[0]
    print(f"Операторов в базе: {operators}")
    
    if operators > 0:
        print("\\nСписок операторов:")
        ops = cursor.execute('SELECT id, name FROM operators').fetchall()
        for op in ops:
            print(f"  ID: {op[0]}, Имя: {op[1]}")
    
    # Расчеты
    calculations = cursor.execute('SELECT COUNT(*) FROM manual_calculations').fetchall()[0]
    print(f"Расчетов в базе: {calculations}")
    
    # Выплаты  
    payments = cursor.execute('SELECT COUNT(*) FROM payments').fetchall()[0]
    print(f"Выплат в базе: {payments}")
    
    conn.close()

check_current_state()
