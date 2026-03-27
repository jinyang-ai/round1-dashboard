-- Sync state table for tracking Google Calendar sync tokens and watch info
CREATE TABLE IF NOT EXISTS sync_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  sync_token TEXT,
  last_synced_at TIMESTAMPTZ,
  watch_channel_id TEXT,
  watch_resource_id TEXT,
  watch_expiration TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row
INSERT INTO sync_state (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to sync_state"
  ON sync_state
  FOR ALL
  USING (true)
  WITH CHECK (true);
