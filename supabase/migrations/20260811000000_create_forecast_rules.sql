-- Migration: Forecast rules
--
-- A third kind of forecast line, alongside hand-written flows (forecast_flows)
-- and individually-marked records (the in_forecast flags added in 20260810).
--
-- Where a marked record is one record in one month, a rule is a saved *query*
-- that emits one line per month, for every year, automatically: "sum the
-- expenses on these accounts, month by month". Change nothing and it keeps
-- itself current as new spending lands.
--
-- Rules read the `expenses` / `plans` tables rather than account_transactions
-- on purpose. The ledger carries edit churn — updateExpense writes a refund row
-- AND a re-deduction row on every edit — so summing its outflows double-counts
-- any edited expense. It also records internal transfers as outflows, and its
-- created_at can disagree with its month_key. The source tables hold one row
-- per real thing, always at the current amount.

CREATE TABLE IF NOT EXISTS forecast_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,

    -- What to count. Direction follows the source: expenses and plans are
    -- outflows, deposits are inflows.
    source TEXT NOT NULL DEFAULT 'expenses'
        CHECK (source IN ('expenses', 'deposits', 'plans')),
    -- Which accounts. Empty = every account.
    account_ids UUID[] NOT NULL DEFAULT '{}',
    -- Optional narrowing by category. Empty = every category.
    category_ids UUID[] NOT NULL DEFAULT '{}',

    -- Skip records the user already marked individually. On by default so a
    -- rule sweeps up everything EXCEPT what is already on the forecast in its
    -- own right — without this, marking one Masrof expense would count it
    -- twice: once alone, once inside the aggregate.
    exclude_linked BOOLEAN NOT NULL DEFAULT TRUE,

    -- What months with no data yet should show. 'none' keeps the rule a purely
    -- historical overlay (future months contribute nothing); the others carry a
    -- figure forward so the rule projects.
    projection TEXT NOT NULL DEFAULT 'none'
        CHECK (projection IN ('none', 'average', 'median', 'last', 'fixed')),
    -- How many months of history the average/median/last methods learn from.
    projection_window INTEGER NOT NULL DEFAULT 3 CHECK (projection_window > 0),
    -- The figure used when projection = 'fixed'.
    fixed_value DECIMAL(14,2),

    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE forecast_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own forecast rules" ON forecast_rules
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own forecast rules" ON forecast_rules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own forecast rules" ON forecast_rules
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own forecast rules" ON forecast_rules
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_forecast_rules_user ON forecast_rules(user_id);

-- Rules aggregate expenses across whole years, so the evaluator range-scans
-- expenses by month. Support that directly.
CREATE INDEX IF NOT EXISTS idx_expenses_user_month ON expenses(user_id, month_key);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_forecast_rules_updated_at BEFORE UPDATE ON forecast_rules
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER audit_forecast_rules_trigger
    AFTER INSERT OR UPDATE OR DELETE ON forecast_rules
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================
-- GRANTS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON forecast_rules TO authenticated;
