-- Phase 6: Day Phase Management
-- Run this in the Supabase SQL editor after phase5.sql

-- Nominations and executions recorded during the day
CREATE TABLE IF NOT EXISTS day_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  day_number   INTEGER     NOT NULL,
  event_type   TEXT        NOT NULL,   -- 'nomination' | 'execution'
  payload      JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE day_events REPLICA IDENTITY FULL;
ALTER TABLE day_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON day_events FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE day_events;

-- Storyteller notes per day (one row per room per day)
CREATE TABLE IF NOT EXISTS day_notes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  day_number   INTEGER     NOT NULL,
  notes        TEXT        NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, day_number)
);

ALTER TABLE day_notes REPLICA IDENTITY FULL;
ALTER TABLE day_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON day_notes FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE day_notes;
