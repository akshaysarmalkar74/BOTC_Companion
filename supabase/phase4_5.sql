-- Phase 4.5: Reminder Token system
-- Run this in the Supabase SQL editor after phase4.sql

CREATE TABLE IF NOT EXISTS reminder_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  room_id    UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  token_key  TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Required for filtered realtime DELETE events
ALTER TABLE reminder_tokens REPLICA IDENTITY FULL;

ALTER TABLE reminder_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON reminder_tokens FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE reminder_tokens;
