import json
import sqlite3
from datetime import datetime

def import_from_backup():
    try:
        # Читаем файл backup с правильной кодировкой
        with open('salary_backup.json', 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        
        conn = sqlite3.connect('operators.db')
        cursor = conn.cursor()
        
        # Очищаем ВСЕ таблицы полностью
        cursor.execute('DELETE FROM operators')
        cursor.execute('DELETE FROM manual_calculations')
        cursor.execute('DELETE FROM payments')
        cursor.execute('DELETE FROM sqlite_sequence')  # Сбрасываем автоинкремент
        
        print("🗑️ Удалены все старые данные")
        
        print("📥 Импорт операторов...")
        # Импортируем операторов
        operators_imported = 0
        for op in data['operators']:
            # Преобразуем данные к новой структуре
            salary_type = 'fixed' if op.get('motivation_type') == 'flat' else 'progressive'
            base_percent = op.get('base_percent')
            
            cursor.execute('''
                INSERT INTO operators (name, salary_type, base_percent, tax_bonus, is_active)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                op['name'],  # Имя уже в правильной кодировке
                salary_type,
                base_percent,
                op.get('tax_bonus', 0),
                op.get('is_active', 1)
            ))
            operators_imported += 1
            print(f"   ✅ {op['name']}")
        
        print("📥 Импорт расчетов...")
        # Импортируем расчеты
        calculations_imported = 0
        for calc in data['manualCalculations']:
            # Находим operator_id по имени оператора
            operator_name = calc.get('operator_name', '')
            cursor.execute('SELECT id FROM operators WHERE name = ?', (operator_name,))
            operator_result = cursor.fetchone()
            
            if operator_result:
                operator_id = operator_result[0]
                
                # Создаем kc_amount и non_kc_amount из процента выкупа
                kc_amount = calc['sales_amount'] * (calc['kc_percent'] / 100)
                non_kc_amount = calc['sales_amount'] - kc_amount
                
                cursor.execute('''
                    INSERT INTO manual_calculations 
                    (operator_id, kc_amount, non_kc_amount, kc_percent, sales_amount, total_salary, calculation_date, comment)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    operator_id,
                    kc_amount,
                    non_kc_amount,
                    calc['kc_percent'],
                    calc['sales_amount'],
                    calc['final_salary'],
                    calc.get('calculation_date', datetime.now().strftime('%Y-%m-%d')),
                    calc.get('comment', '')
                ))
                calculations_imported += 1
                print(f"   ✅ Расчет для {operator_name}: {calc['final_salary']:,.0f} руб.")
        
        print("📥 Импорт выплат...")
        # Импортируем выплаты
        payments_imported = 0
        for payment in data['payments']:
            # Находим operator_id по имени оператора
            operator_name = payment.get('operator_name', '')
            cursor.execute('SELECT id FROM operators WHERE name = ?', (operator_name,))
            operator_result = cursor.fetchone()
            
            if operator_result:
                operator_id = operator_result[0]
                
                cursor.execute('''
                    INSERT INTO payments 
                    (operator_id, calculation_date, total_salary, is_paid, payment_date, comment)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    operator_id,
                    payment.get('calculation_date', datetime.now().strftime('%Y-%m-%d')),
                    payment['final_salary'],
                    payment.get('is_paid', False),
                    payment.get('payment_date', ''),
                    payment.get('comment', '')
                ))
                payments_imported += 1
        
        conn.commit()
        conn.close()
        
        print(f"✅ Импорт завершен:")
        print(f"   Операторов: {operators_imported}")
        print(f"   Расчетов: {calculations_imported}") 
        print(f"   Выплат: {payments_imported}")
        
    except Exception as e:
        print(f"❌ Ошибка импорта: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    import_from_backup()
