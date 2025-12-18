import sqlite3

def init_test_data():
    conn = sqlite3.connect('operators.db')
    cursor = conn.cursor()
    
    # Очищаем таблицы
    cursor.execute('DELETE FROM operators')
    cursor.execute('DELETE FROM manual_calculations') 
    cursor.execute('DELETE FROM payments')
    
    # Добавляем тестовых операторов
    test_operators = [
        ('Иванов Иван Иванович', 'fixed', 15.0, 500, 1),
        ('Петров Петр Петрович', 'progressive', None, 300, 1),
        ('Сидорова Мария Сергеевна', 'fixed', 12.0, 400, 1)
    ]
    
    cursor.executemany('''
        INSERT INTO operators (name, salary_type, base_percent, tax_bonus, is_active)
        VALUES (?, ?, ?, ?, ?)
    ''', test_operators)
    
    # Добавляем тестовые настройки
    cursor.executemany('''
        INSERT OR REPLACE INTO system_settings (setting_key, setting_value, description)
        VALUES (?, ?, ?)
    ''', [
        ('progressive_level_1', '0', 'Уровень 1: 0% бонус'),
        ('progressive_level_2', '6', 'Уровень 2: 6% бонус'),
        ('progressive_level_3', '10', 'Уровень 3: 10% бонус'),
        ('progressive_level_4', '14', 'Уровень 4: 14% бонус'),
        ('progressive_level_5', '20', 'Уровень 5: 20% бонус')
    ])
    
    conn.commit()
    conn.close()
    print("✅ Тестовые данные добавлены")

if __name__ == "__main__":
    init_test_data()
