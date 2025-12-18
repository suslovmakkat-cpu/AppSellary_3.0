import json
import sqlite3
from datetime import datetime

def simple_import():
    print("🚀 ЗАПУСК УПРОЩЕННОГО ИМПОРТА")
    
    try:
        # Читаем файл
        with open('salary_backup.json', 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        
        conn = sqlite3.connect('operators.db')
        cursor = conn.cursor()
        
        # ОЧИСТКА
        cursor.execute('DELETE FROM operators')
        cursor.execute('DELETE FROM manual_calculations') 
        cursor.execute('DELETE FROM payments')
        
        print("✅ Таблицы очищены")
        
        # ИМПОРТ ОПЕРАТОРОВ
        print("\\n📥 Импортируем операторов...")
        for op in data['operators']:
            name = op['name']
            salary_type = 'fixed' if op.get('motivation_type') == 'flat' else 'progressive'
            base_percent = op.get('base_percent', 0)
            tax_bonus = op.get('tax_bonus', 0)
            
            cursor.execute('''
                INSERT INTO operators (name, salary_type, base_percent, tax_bonus, is_active)
                VALUES (?, ?, ?, ?, ?)
            ''', (name, salary_type, base_percent, tax_bonus, 1))
            
            print(f"   ✅ {name}")
        
        # ИМПОРТ РАСЧЕТОВ
        print("\\n📥 Импортируем расчеты...")
        for calc in data['manualCalculations']:
            # Находим ID оператора по имени
            cursor.execute('SELECT id FROM operators WHERE name = ?', (calc['operator_name'],))
            operator = cursor.fetchone()
            
            if operator:
                operator_id = operator[0]
                kc_amount = calc['sales_amount'] * (calc['kc_percent'] / 100)
                non_kc_amount = calc['sales_amount'] - kc_amount
                
                cursor.execute('''
                    INSERT INTO manual_calculations 
                    (operator_id, kc_amount, non_kc_amount, kc_percent, sales_amount, total_salary, calculation_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (operator_id, kc_amount, non_kc_amount, calc['kc_percent'], 
                      calc['sales_amount'], calc['final_salary'], calc.get('calculation_date', '2025-11-05')))
                
                print(f"   ✅ Расчет для {calc['operator_name']}: {calc['final_salary']:,.0f} руб.")
        
        # ИМПОРТ ВЫПЛАТ
        print("\\n📥 Импортируем выплаты...")
        for payment in data['payments']:
            cursor.execute('SELECT id FROM operators WHERE name = ?', (payment['operator_name'],))
            operator = cursor.fetchone()
            
            if operator:
                operator_id = operator[0]
                
                cursor.execute('''
                    INSERT INTO payments 
                    (operator_id, calculation_date, total_salary, is_paid)
                    VALUES (?, ?, ?, ?)
                ''', (operator_id, payment.get('calculation_date', '2025-11-05'), 
                      payment['final_salary'], payment.get('is_paid', False)))
        
        conn.commit()
        conn.close()
        
        print("\\n🎉 ИМПОРТ УСПЕШНО ЗАВЕРШЕН!")
        
    except Exception as e:
        print(f"❌ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    simple_import()
