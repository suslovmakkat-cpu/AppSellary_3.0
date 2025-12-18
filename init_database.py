import sqlite3
import os

def init_database():
    conn = sqlite3.connect('operators.db')
    cursor = conn.cursor()
    
    # Создаем таблицы
    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS operators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            salary_type TEXT DEFAULT 'progressive',
            base_percent REAL,
            tax_bonus REAL DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS manual_calculations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operator_id INTEGER NOT NULL,
            kc_amount REAL DEFAULT 0,
            non_kc_amount REAL DEFAULT 0,
            kc_percent REAL DEFAULT 0,
            sales_amount REAL DEFAULT 0,
            total_salary REAL DEFAULT 0,
            calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (operator_id) REFERENCES operators (id)
        );

        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operator_id INTEGER NOT NULL,
            calculation_date DATE,
            total_salary REAL DEFAULT 0,
            is_paid INTEGER DEFAULT 0,
            payment_date DATE,
            FOREIGN KEY (operator_id) REFERENCES operators (id)
        );

        CREATE TABLE IF NOT EXISTS system_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key TEXT UNIQUE NOT NULL,
            setting_value TEXT,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS action_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action_type TEXT NOT NULL,
            action_details TEXT,
            operator_id INTEGER,
            performed_by TEXT,
            action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    
    # Добавляем начальные данные
    cursor.executescript('''
        INSERT OR IGNORE INTO operators (name, salary_type, base_percent, tax_bonus) VALUES 
        ('Иванов Иван', 'fixed', 15.0, 500),
        ('Петров Петр', 'progressive', NULL, 300),
        ('Сидорова Мария', 'fixed', 12.0, 400);
        
        INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description) VALUES 
        ('progressive_level_1', '0-46.99:0', 'Уровень 1: 0-46.99% = 0% бонус'),
        ('progressive_level_2', '47-52.99:6', 'Уровень 2: 47-52.99% = 6% бонус'),
        ('progressive_level_3', '53-57.99:10', 'Уровень 3: 53-57.99% = 10% бонус'),
        ('progressive_level_4', '58-100:14', 'Уровень 4: 58%+ = 14% бонус'),
        ('progressive_level_5', 'special:20', 'Уровень 5: особые достижения = 20% бонус'),
        ('auto_create_payments', 'true', 'Автоматическое создание выплат');
    ''')
    
    conn.commit()
    conn.close()
    print("✅ База данных инициализирована с тестовыми данными")

if __name__ == "__main__":
    init_database()
