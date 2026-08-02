-- Blood on the Clocktower Companion – Phase 2 Migration
-- Run this in the Supabase SQL Editor AFTER phase1 schema is in place.

-- Add script column to rooms: stores an ordered array of character IDs
-- (e.g. ["washerwoman","chef","imp"]).
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS script JSONB NOT NULL DEFAULT '[]'::jsonb;
