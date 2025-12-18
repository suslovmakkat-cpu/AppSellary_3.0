import sqlite3
import json
from datetime import datetime

def system_diagnostics():
    print("=== ДИАГНОСТИКА СИСТЕМЫ РАСЧЕТА ЗП ===")
    
    # Проверка базы данных
    try:
        conn = sqlite3.connect('operators.db')
        cursor = conn.cursor()
        
        print("\n📊 БАЗА ДАННЫХ:")
        # Таблицы
        tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        print(f"Таблицы: {[table[0] for table in tables]}")
        
        # Операторы
        operators_count = cursor.execute("SELECT COUNT(*) FROM operators").fetchone()[0]
        print(f"Операторов: {operators_count}")
        
        # Расчеты
        calculations_count = cursor.execute("SELECT COUNT(*) FROM manual_calculations").fetchone()[0]
        print(f"Расчетов: {calculations_count}")
        
        # Выплаты
        payments_count = cursor.execute("SELECT COUNT(*) FROM payments").fetchone()[0]
        print(f"Выплат: {payments_count}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Ошибка БД: {e}")
    
    # Проверка файлов
    print("\n📁 ФАЙЛЫ:")
    import os
    files = os.listdir('.')
    py_files = [f for f in files if f.endswith('.py')]
    print(f"Python файлы: {len(py_files)}")
    print(f"Всего файлов: {len(files)}")
    
    # Проверка импортов
    print("\n🔧 ПРОВЕРКА ИМПОРТОВ:")
    try:
        from calculations import calculate_salary
        print("✅ calculations.py - OK")
    except Exception as e:
        print(f"❌ calculations.py: {e}")
    
    try:
        from operators import get_all_operators
        print("✅ operators.py - OK")
    except Exception as e:
        print(f"❌ operators.py: {e}")
    
    try:
        from payments import create_payment
        print("✅ payments.py - OK")
    except Exception as e:
        print(f"❌ payments.py: {e}")
    
    print("\n=== ДИАГНОСТИКА ЗАВЕРШЕНА ===")

if __name__ == "__main__":
    system_diagnostics()
