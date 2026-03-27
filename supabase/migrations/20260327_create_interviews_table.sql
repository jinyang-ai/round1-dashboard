-- Create interviews table
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  client TEXT,
  role_type TEXT,
  candidate_name TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_mins INTEGER,
  interviewers TEXT[],
  interviewer_names TEXT[],
  status TEXT DEFAULT 'scheduled',
  month TEXT,
  day_of_week TEXT,
  hour INTEGER,
  raw_json JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_interviews_client ON interviews(client);
CREATE INDEX IF NOT EXISTS idx_interviews_start_time ON interviews(start_time);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_calendar_event_id ON interviews(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_interviews_month ON interviews(month);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_interviews_updated_at 
  BEFORE UPDATE ON interviews 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (but allow all for now - we'll secure via service role)
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (we'll use service role key)
CREATE POLICY "Allow all operations" ON interviews FOR ALL USING (true);
