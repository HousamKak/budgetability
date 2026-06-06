-- Migration: Forecast flows (cash-flow uncertainty modeling)
-- Backs the Forecast page: per-flow projected inflows/outflows across months of a
-- year, optionally with an uncertainty range (low/high) producing best/worst
-- scenario bands. "Ghost" flows are hypothetical what-if templates.
-- Amounts are stored in the app's real currency (dollars), positive magnitude;
-- the `type` ('in'/'out') determines the sign in calculations.

CREATE TABLE IF NOT EXISTS forecast_flows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    year INTEGER NOT NULL,
    months INTEGER[] NOT NULL DEFAULT '{}',          -- 1..12 the flow occurs in
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    name TEXT,
    uncertain BOOLEAN NOT NULL DEFAULT FALSE,
    value DECIMAL(14,2),                              -- certain amount (magnitude)
    low_value DECIMAL(14,2),                          -- uncertain low (magnitude)
    high_value DECIMAL(14,2),                         -- uncertain high (magnitude)
    is_ghost BOOLEAN NOT NULL DEFAULT FALSE,          -- hypothetical what-if
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE forecast_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own forecast flows" ON forecast_flows
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own forecast flows" ON forecast_flows
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own forecast flows" ON forecast_flows
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own forecast flows" ON forecast_flows
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_forecast_flows_user ON forecast_flows(user_id);
CREATE INDEX IF NOT EXISTS idx_forecast_flows_user_year ON forecast_flows(user_id, year);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_forecast_flows_updated_at BEFORE UPDATE ON forecast_flows
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER audit_forecast_flows_trigger
    AFTER INSERT OR UPDATE OR DELETE ON forecast_flows
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================
-- GRANTS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON forecast_flows TO authenticated;
