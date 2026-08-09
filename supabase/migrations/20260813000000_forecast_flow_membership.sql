-- Migration: forecast flow membership
--
-- Lets several related records add up to one forecast line. A day's ipad, the
-- two meals and the taxis around it are seven separate expenses but one thing
-- you'd recognise on a forecast, and typing an estimate for the group loses
-- both the detail and the accuracy.
--
-- The pointer lives on the record, not as a list of ids on the flow. That way a
-- record belongs to at most one flow, so double-counting is impossible by
-- construction rather than by vigilance; deleting an expense removes it from
-- its group automatically; and deleting the flow just unlinks its members
-- instead of stranding ids that no longer resolve.

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS forecast_flow_id UUID
        REFERENCES forecast_flows(id) ON DELETE SET NULL;

ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS forecast_flow_id UUID
        REFERENCES forecast_flows(id) ON DELETE SET NULL;

ALTER TABLE account_transactions
    ADD COLUMN IF NOT EXISTS forecast_flow_id UUID
        REFERENCES forecast_flows(id) ON DELETE SET NULL;

-- 'picked' is a computed flow whose members are whatever points at it, rather
-- than whatever matches a filter.
ALTER TABLE forecast_flows
    DROP CONSTRAINT IF EXISTS forecast_flows_rule_source_check;
ALTER TABLE forecast_flows
    ADD CONSTRAINT forecast_flows_rule_source_check
    CHECK (rule_source IS NULL
           OR rule_source IN ('expenses', 'deposits', 'plans', 'picked'));

-- A record is standalone-marked, or a member of a group, or neither — never
-- both, which would count it twice.
ALTER TABLE expenses
    DROP CONSTRAINT IF EXISTS expenses_forecast_single_home;
ALTER TABLE expenses
    ADD CONSTRAINT expenses_forecast_single_home
    CHECK (NOT (in_forecast AND forecast_flow_id IS NOT NULL));

ALTER TABLE plans
    DROP CONSTRAINT IF EXISTS plans_forecast_single_home;
ALTER TABLE plans
    ADD CONSTRAINT plans_forecast_single_home
    CHECK (NOT (in_forecast AND forecast_flow_id IS NOT NULL));

ALTER TABLE account_transactions
    DROP CONSTRAINT IF EXISTS account_transactions_forecast_single_home;
ALTER TABLE account_transactions
    ADD CONSTRAINT account_transactions_forecast_single_home
    CHECK (NOT (in_forecast AND forecast_flow_id IS NOT NULL));

-- ============================================
-- INDEXES
-- ============================================
-- Members are looked up per flow when the forecast is built.
CREATE INDEX IF NOT EXISTS idx_expenses_forecast_flow
    ON expenses(forecast_flow_id) WHERE forecast_flow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plans_forecast_flow
    ON plans(forecast_flow_id) WHERE forecast_flow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_account_transactions_forecast_flow
    ON account_transactions(forecast_flow_id) WHERE forecast_flow_id IS NOT NULL;
