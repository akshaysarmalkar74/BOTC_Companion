-- Blood on the Clocktower Companion – Phase 3 Migration
-- Run in the Supabase SQL Editor AFTER phase1 and phase2 SQL are in place.

-- Room lifecycle state: 'lobby' while setting up, 'in_progress' once game starts.
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'lobby';

-- The character ID assigned to each player (null until the host assigns roles).
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS role TEXT;

-- ── Row Level Security notes ───────────────────────────────────────────────────
--
-- Ideal RLS for the role column would restrict players to reading only their own
-- row's role field. That requires Supabase Auth so RLS policies can reference
-- auth.uid(). Since Phase 3 uses anonymous sessions, the frontend enforces
-- privacy instead:
--
--   • The lobby query selects explicit columns and EXCLUDES the role column.
--   • Players fetch their own role via a targeted query filtered by their own ID.
--   • The host fetches all roles only on the assignment / game pages.
--
-- When Supabase Auth is introduced in a future phase, add a policy like:
--
--   CREATE POLICY "Players read own role"
--     ON players FOR SELECT
--     USING (auth.uid()::text = id OR is_host = true);
--
-- For now the existing open policies remain in place.
