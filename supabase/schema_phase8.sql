-- Phase 8: Game History
-- Run this in the Supabase SQL editor after schema_phase7.sql

-- ── game_events ────────────────────────────────────────────────────────────────
-- Unified chronological event log for every significant game moment.
-- Written by the app; never mutated after insert; used as the source of truth
-- for the history page, replay mode, and future AI/export features.

CREATE TABLE IF NOT EXISTS game_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,

  -- Which phase this event belongs to ("Setup", "Night 1", "Day 2", …)
  phase               text        NOT NULL,

  -- Machine-readable category (see GameEventType in src/types/index.ts)
  event_type          text        NOT NULL,

  -- Human-readable sentence — the primary display text
  description         text        NOT NULL,

  -- UUIDs of players directly involved (stored as text[] to avoid cast issues)
  affected_player_ids text[]      NOT NULL DEFAULT '{}',

  -- Arbitrary structured data for each event type (see gameHistory.ts for shapes)
  metadata            jsonb       NOT NULL DEFAULT '{}',

  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Fast lookups for the history page
CREATE INDEX IF NOT EXISTS game_events_room_phase
  ON game_events (room_id, phase);

CREATE INDEX IF NOT EXISTS game_events_room_created
  ON game_events (room_id, created_at);

-- Partial index for player-journey queries
CREATE INDEX IF NOT EXISTS game_events_room_players
  ON game_events USING GIN (affected_player_ids)
  WHERE array_length(affected_player_ids, 1) > 0;

-- RLS
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open read game_events"
  ON game_events FOR SELECT USING (true);

CREATE POLICY "open insert game_events"
  ON game_events FOR INSERT WITH CHECK (true);

-- Realtime (for live history panel if needed in future)
ALTER PUBLICATION supabase_realtime ADD TABLE game_events;
