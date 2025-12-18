-- ===== EXISTING TABLES (UNCHANGED) =====

CREATE TABLE IF NOT EXISTS operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    salary_type TEXT DEFAULT 'progressive',
    base_percent REAL,
    tax_bonus REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,

    -- soft delete
    is_deleted INTEGER DEFAULT 0,
    deleted_at TIMESTAMP,

    motivation_id INTEGER,

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
    redemption_percent REAL DEFAULT 0,
    manual_fixed_bonus REAL DEFAULT 0,
    manual_penalty REAL DEFAULT 0,
    bonus_percent_salary REAL DEFAULT 0,
    bonus_percent_sales REAL DEFAULT 0,
    applied_motivation_id INTEGER,
    applied_motivation_name TEXT,
    motivation_snapshot TEXT,
    calculation_breakdown TEXT,
    calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    period_start TEXT,
    period_end TEXT,
    additional_bonus REAL DEFAULT 0,
    penalty_amount REAL DEFAULT 0,
    working_days_in_period REAL DEFAULT 0,
    plan_target REAL DEFAULT 0,
    plan_completion REAL DEFAULT 0,

    -- soft delete
    is_deleted INTEGER DEFAULT 0,
    deleted_at TIMESTAMP,

    FOREIGN KEY (operator_id) REFERENCES operators (id)
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_id INTEGER NOT NULL,
    calculation_date DATE,
    total_salary REAL DEFAULT 0,
    is_paid INTEGER DEFAULT 0,
    payment_date DATE,

    period_start DATE,
    period_end DATE,
    sales_amount REAL DEFAULT 0,
    additional_bonus REAL DEFAULT 0,
    penalty_amount REAL DEFAULT 0,

    -- soft delete
    is_deleted INTEGER DEFAULT 0,
    deleted_at TIMESTAMP,

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

-- ===== NEW TABLES FOR MOTIVATIONS =====

CREATE TABLE IF NOT EXISTS motivations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,

    -- motivation type: fixed / progressive / custom
    motivation_type TEXT NOT NULL,

    -- JSON with rules (percent levels, conditions, etc.)
    config_json TEXT NOT NULL,

    is_active INTEGER DEFAULT 1,

    -- soft delete
    is_deleted INTEGER DEFAULT 0,
    deleted_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== INDEXES (SAFE) =====

CREATE INDEX IF NOT EXISTS idx_operators_active
ON operators (is_active, is_deleted);

CREATE INDEX IF NOT EXISTS idx_calculations_operator
ON manual_calculations (operator_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_payments_operator
ON payments (operator_id, is_deleted);
