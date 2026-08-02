-- Phase 5: Night Assistant
-- Run this in the Supabase SQL editor after phase4_5.sql

-- Track which step the Night Assistant is currently showing
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS night_step_key TEXT;

-- Records every Storyteller decision made during a night
CREATE TABLE IF NOT EXISTS night_actions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  night_number  INTEGER     NOT NULL,
  step_key      TEXT        NOT NULL,
  target_ids    UUID[]      NOT NULL DEFAULT '{}',
  notes         TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, night_number, step_key)
);

ALTER TABLE night_actions REPLICA IDENTITY FULL;

ALTER TABLE night_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON night_actions FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE night_actions;
