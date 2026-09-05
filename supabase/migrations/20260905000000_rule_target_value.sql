-- A computed flow can carry a committed plan number per month. When set, the
-- current and future months forecast with this figure while the real total
-- stays visible beside it.
ALTER TABLE forecast_flows ADD COLUMN IF NOT EXISTS rule_target_value DECIMAL(14,2);
