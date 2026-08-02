-- Phase 4: Storyteller Grimoire
-- Run this in the Supabase SQL editor after phase3.sql

-- Player state managed by the Storyteller during a game
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_alive        BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ghost_vote_used BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS notes           TEXT    NOT NULL DEFAULT '';

-- Current game phase displayed in the Grimoire centre panel (e.g. "Night 1", "Day 2")
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'Night 1';
