-- Bot players support — run this in the Supabase SQL Editor.
-- Adds is_bot flag to players so the Narrator can add placeholder seats for testing.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
