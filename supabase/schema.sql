-- Blood on the Clocktower Companion – Phase 1 Schema
-- Run this in the Supabase SQL Editor to set up the database.

-- Rooms table
CREATE TABLE rooms (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT        UNIQUE NOT NULL,
  host_id    UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table
CREATE TABLE players (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  display_name TEXT        NOT NULL,
  is_host      BOOLEAN     NOT NULL DEFAULT FALSE,
  seat_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key from rooms back to the host player (set after room creation)
ALTER TABLE rooms
  ADD CONSTRAINT fk_rooms_host_player
  FOREIGN KEY (host_id) REFERENCES players(id) ON DELETE SET NULL;

-- Index for fast per-room player lookups
CREATE INDEX idx_players_room_id ON players(room_id);

-- Full replica identity so DELETE and UPDATE events carry all column values.
-- Required for Supabase Realtime filtered subscriptions on non-PK columns.
ALTER TABLE players REPLICA IDENTITY FULL;
ALTER TABLE rooms   REPLICA IDENTITY FULL;

-- Row Level Security: enabled but open for Phase 1 (no authentication yet)
ALTER TABLE rooms   ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on rooms"   ON rooms   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on players" ON players FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
