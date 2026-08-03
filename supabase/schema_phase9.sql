-- Phase 9: Game Management & Production Readiness
-- Run this in the Supabase SQL editor.

-- ── rooms: add outcome and ended_at columns ───────────────────────────────────

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS outcome   text,         -- 'good' | 'evil' | 'cancelled' | null
  ADD COLUMN IF NOT EXISTS ended_at  timestamptz;  -- when the game ended

-- ── game_events: add 'game_end' to valid event types (no enum, just text) ─────
-- No schema change needed — event_type is already text.

-- ── night_actions: ensure table exists (idempotent) ──────────────────────────
-- Already created in schema_phase7.sql. No changes needed here.

-- ── Index: completed games lookup ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms (status);
