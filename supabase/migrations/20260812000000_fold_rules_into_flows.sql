-- Migration: fold forecast rules into forecast flows
--
-- Rules shipped as their own table and their own dialog, which made them a
-- second kind of object living beside flows — and left them unscoped, applying
-- to every month of every year with no way to say where they belong.
--
-- They are better understood as one thing: a flow whose amount is *computed*
-- rather than typed. Same name, same year, same months, same on/off switch —
-- only the source of the number differs. Folding the rule fields onto
-- forecast_flows gives rules the year and month pickers flows already have, and
-- collapses two dialogs back into one.
--
-- rule_source IS NULL  -> an ordinary flow, amount from value / low+high
-- rule_source NOT NULL -> a computed flow, amount summed per month from records

ALTER TABLE forecast_flows
    ADD COLUMN IF NOT EXISTS rule_source TEXT
        CHECK (rule_source IS NULL OR rule_source IN ('expenses', 'deposits', 'plans')),
    ADD COLUMN IF NOT EXISTS rule_account_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS rule_category_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS rule_exclude_linked BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS rule_projection TEXT NOT NULL DEFAULT 'none'
        CHECK (rule_projection IN ('none', 'average', 'median', 'last', 'fixed')),
    ADD COLUMN IF NOT EXISTS rule_projection_window INTEGER NOT NULL DEFAULT 3
        CHECK (rule_projection_window > 0),
    ADD COLUMN IF NOT EXISTS rule_fixed_value DECIMAL(14,2);

-- Carry across anything already created in the short window the separate table
-- existed. The old rules had no scope, so they become all-year flows on the
-- current year — the closest honest reading of "everywhere".
INSERT INTO forecast_flows (
    user_id, year, months, type, name, uncertain, value,
    is_ghost, enabled, sort_order,
    rule_source, rule_account_ids, rule_category_ids, rule_exclude_linked,
    rule_projection, rule_projection_window, rule_fixed_value
)
SELECT
    r.user_id,
    EXTRACT(YEAR FROM NOW())::int,
    ARRAY[1,2,3,4,5,6,7,8,9,10,11,12],
    CASE WHEN r.source = 'deposits' THEN 'in' ELSE 'out' END,
    r.name,
    FALSE,
    NULL,
    FALSE,
    r.enabled,
    r.sort_order,
    r.source, r.account_ids, r.category_ids, r.exclude_linked,
    r.projection, r.projection_window, r.fixed_value
FROM forecast_rules r;

DROP TABLE IF EXISTS forecast_rules;

-- Computed flows are read as a group on every forecast load.
CREATE INDEX IF NOT EXISTS idx_forecast_flows_rules
    ON forecast_flows(user_id) WHERE rule_source IS NOT NULL;
