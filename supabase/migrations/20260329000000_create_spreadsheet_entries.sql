-- Create spreadsheet_entries table for manual spreadsheet data
CREATE TABLE IF NOT EXISTS spreadsheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  column_key TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_key, column_key)
);

ALTER TABLE spreadsheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own spreadsheet entries"
  ON spreadsheet_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
