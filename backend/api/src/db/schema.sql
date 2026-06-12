-- Budgetability schema — SQLite port of supabase/migrations/*.
-- Tables/columns/constraints mirror the Postgres deployment (snake_case kept)
-- so a future migration is a mechanical copy. Differences:
--   * auth.users + profiles  ->  users (with password_hash) here
--   * UUIDs are TEXT, generated in app code (crypto.randomUUID)
--   * TIMESTAMPTZ -> TEXT ISO-8601 (UTC), DATE -> TEXT "YYYY-MM-DD"
--   * Postgres trigger logic (balances, savings progress, single default
--     account) is enforced in the service layer inside transactions.
--   * forecast_flows.months INTEGER[] -> TEXT JSON array

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================== auth ==============================

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT,
    avatar_url    TEXT,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS api_tokens (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    token_hash   TEXT UNIQUE NOT NULL,
    last_used_at TEXT,
    revoked_at   TEXT,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);

-- ============================== core ==============================

CREATE TABLE IF NOT EXISTS budgets (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_key  TEXT NOT NULL,                       -- "YYYY-MM"
    amount     REAL NOT NULL CHECK (amount >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (user_id, month_key)
);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month_key);

CREATE TABLE IF NOT EXISTS categories (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL,
    icon       TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(user_id, sort_order);

CREATE TABLE IF NOT EXISTS account_groups (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT,
    icon       TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS accounts (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    account_type    TEXT NOT NULL CHECK (account_type IN ('checking','savings','credit','cash','other')),
    initial_balance REAL NOT NULL DEFAULT 0,
    current_balance REAL NOT NULL DEFAULT 0,
    is_default      INTEGER DEFAULT 0,
    color           TEXT,
    icon            TEXT,
    sort_order      INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_accounts_default ON accounts(user_id, is_default);

CREATE TABLE IF NOT EXISTS account_group_members (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id   TEXT NOT NULL REFERENCES account_groups(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (group_id, account_id)
);

CREATE TABLE IF NOT EXISTS expenses (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_key   TEXT NOT NULL,                      -- "YYYY-MM"
    date        TEXT NOT NULL,                      -- "YYYY-MM-DD"
    amount      REAL NOT NULL CHECK (amount > 0),
    category    TEXT,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    account_id  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    note        TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_month ON expenses(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);

CREATE TABLE IF NOT EXISTS plans (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_key    TEXT NOT NULL,                     -- "YYYY-MM"
    week_index   INTEGER NOT NULL CHECK (week_index >= 0 AND week_index <= 4),
    amount       REAL NOT NULL CHECK (amount > 0),
    category     TEXT,
    category_id  TEXT REFERENCES categories(id) ON DELETE SET NULL,
    account_id   TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    note         TEXT,
    target_date  TEXT,                              -- "YYYY-MM-DD"
    is_completed INTEGER DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_plans_user_month ON plans(user_id, month_key);

CREATE TABLE IF NOT EXISTS drafts (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note        TEXT NOT NULL,
    amount      REAL CHECK (amount > 0),
    category    TEXT,
    account_id  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    date        TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_drafts_user ON drafts(user_id);

-- ============================ envelopes ===========================

CREATE TABLE IF NOT EXISTS account_transactions (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_account_id  TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    to_account_id    TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    amount           REAL NOT NULL CHECK (amount > 0),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN
        ('transfer','budget_allocation','savings_contribution','overdraft_coverage','deposit','expense')),
    month_key        TEXT,
    savings_goal_id  TEXT REFERENCES savings_goals(id) ON DELETE SET NULL,
    note             TEXT,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON account_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_from ON account_transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_tx_to ON account_transactions(to_account_id);
CREATE INDEX IF NOT EXISTS idx_tx_month ON account_transactions(month_key);

CREATE TABLE IF NOT EXISTS budget_allocations (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    month_key  TEXT NOT NULL,
    amount     REAL NOT NULL CHECK (amount >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (user_id, account_id, month_key)
);
CREATE INDEX IF NOT EXISTS idx_alloc_user_month ON budget_allocations(user_id, month_key);

-- ============================= savings ============================

CREATE TABLE IF NOT EXISTS savings_goals (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    target_amount  REAL NOT NULL CHECK (target_amount > 0),
    current_amount REAL NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
    image_url      TEXT,
    deadline       TEXT,
    color          TEXT,
    is_completed   INTEGER DEFAULT 0,
    completed_at   TEXT,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON savings_goals(user_id);

CREATE TABLE IF NOT EXISTS savings_contributions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    savings_goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
    account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE SET NULL,
    amount          REAL NOT NULL CHECK (amount > 0),
    note            TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_contrib_goal ON savings_contributions(savings_goal_id);

-- ============================ forecast ============================

CREATE TABLE IF NOT EXISTS forecast_flows (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year       INTEGER NOT NULL,
    months     TEXT NOT NULL DEFAULT '[]',          -- JSON array of 1..12
    type       TEXT NOT NULL CHECK (type IN ('in','out')),
    name       TEXT,
    uncertain  INTEGER NOT NULL DEFAULT 0,
    value      REAL,
    low_value  REAL,
    high_value REAL,
    is_ghost   INTEGER NOT NULL DEFAULT 0,
    enabled    INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_forecast_user_year ON forecast_flows(user_id, year);

-- =========================== spreadsheet ==========================

CREATE TABLE IF NOT EXISTS spreadsheet_entries (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_key  TEXT NOT NULL,
    column_key TEXT NOT NULL,
    value      REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (user_id, month_key, column_key)
);

-- ============================== audit =============================

CREATE TABLE IF NOT EXISTS audit_logs (
    id         TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id  TEXT NOT NULL,
    action     TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    old_data   TEXT,                                -- JSON
    new_data   TEXT,                                -- JSON
    user_id    TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
