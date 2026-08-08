-- Drunk role support — run this in the Supabase SQL Editor.
-- Stores the fake Townsfolk role the Drunk player thinks they have.
-- The player's actual role stays 'drunk'; this is the bluff shown to them.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS drunk_role TEXT NULL;
