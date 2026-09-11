-- The forecast's opening balance used to live in browser localStorage, so
-- each device could show a different forecast. Store it per user instead.
-- NULL means never saved; the app seeds it once from the device value.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS forecast_opening_balance DECIMAL(14,2);
