import sqlite3

def update_database_structure():
    conn = sqlite3.connect('operators.db')
    cursor = conn.cursor()
    
    try:
        # Добавляем поля для периодов в manual_calculations
        cursor.execute('''
            ALTER TABLE manual_calculations ADD COLUMN period_start DATE
        ''')
    except:
        pass
        
    try:
        cursor.execute('''
            ALTER TABLE manual_calculations ADD COLUMN period_end DATE
        ''')
    except:
        pass
        
    try:
        cursor.execute('''
            ALTER TABLE manual_calculations ADD COLUMN additional_bonus REAL DEFAULT 0
        ''')
    except:
        pass
        
    try:
        cursor.execute('''
            ALTER TABLE manual_calculations ADD COLUMN penalty_amount REAL DEFAULT 0
        ''')
    except:
        pass
        
    try:
        cursor.execute('''
            ALTER TABLE manual_calculations ADD COLUMN comment TEXT
        ''')
    except:
        pass
    
    # Обновляем таблицу выплат
    try:
        cursor.execute('''
            ALTER TABLE payments ADD COLUMN period_start DATE
        ''')
    except:
        pass
        
    try:
        cursor.execute('''
            ALTER TABLE payments ADD COLUMN period_end DATE
        ''')
    except:
        pass
        
    try:
        cursor.execute('''
            ALTER TABLE payments ADD COLUMN sales_amount REAL DEFAULT 0
        ''')
    except:
        pass
        
    try:
        cursor.execute('''
            ALTER TABLE payments ADD COLUMN additional_bonus REAL DEFAULT 0
        ''')
    except:
        pass
        
    try:
        cursor.execute('''
            ALTER TABLE payments ADD COLUMN penalty_amount REAL DEFAULT 0
        ''')
    except:
        pass
    
    # Добавляем расширенные настройки прогрессивной системы
    settings_to_add = [
        ('progressive_level_2_min', '47', 'Минимальный % выкупа для уровня 2'),
        ('progressive_level_2_max', '52.99', 'Максимальный % выкупа для уровня 2'),
        ('progressive_level_3_min', '53', 'Минимальный % выкупа для уровня 3'),
        ('progressive_level_3_max', '57.99', 'Максимальный % выкупа для уровня 3'),
        ('progressive_level_4_min', '58', 'Минимальный % выкупа для уровня 4'),
        ('auto_create_payments', 'true', 'Автоматическое создание выплат'),
        ('default_tax_bonus', '6', 'Надбавка на налог по умолчанию')
    ]
    
    for key, value, description in settings_to_add:
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description)
                VALUES (?, ?, ?)
            ''', (key, value, description))
        except:
            pass
    
    conn.commit()
    conn.close()
    print("✅ Структура базы данных обновлена")

if __name__ == "__main__":
    update_database_structure()
