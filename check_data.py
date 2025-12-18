import sqlite3

def check_imported_data():
    conn = sqlite3.connect('operators.db')
    cursor = conn.cursor()
    
    # Проверяем операторов
    operators = cursor.execute('SELECT COUNT(*) FROM operators').fetchone()[0]
    calculations = cursor.execute('SELECT COUNT(*) FROM manual_calculations').fetchone()[0]
    payments = cursor.execute('SELECT COUNT(*) FROM payments').fetchone()[0]
    
    print(f"📋 В базе данных:")
    print(f"   Операторов: {operators}")
    print(f"   Расчетов: {calculations}")
    print(f"   Выплат: {payments}")
    
    # Показываем операторов
    print("\\n👥 Операторы:")
    operators_list = cursor.execute('SELECT id, name, salary_type, base_percent FROM operators').fetchall()
    for op in operators_list:
        print(f"   {op[0]}. {op[1]} - {op[2]} ({op[3]}%)")
    
    conn.close()

if __name__ == "__main__":
    check_imported_data()
