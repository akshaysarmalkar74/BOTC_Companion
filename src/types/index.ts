export interface Room {
  id: string;
  code: string;
  host_id: string | null;
  script: string[]; // array of character IDs — added Phase 2
  created_at: string;
}

// ── Character types ────────────────────────────────────────────────

export type Team = 'townsfolk' | 'outsider' | 'minion' | 'demon';

/**
 * A single character entry in the game library.
 *
 * Fields marked "future" are intentionally absent in Phase 2 but
 * the model is designed to accommodate them without structural change.
 *
 * Future fields to add here:
 *   firstNight?   : { order: number; reminder: string }
 *   otherNights?  : { order: number; reminder: string }
 *   reminders?    : string[]
 *   isSetup?      : boolean   // Baron, Drunk — affect bag composition
 *   isOncePerGame?: boolean   // Slayer, etc.
 */
export interface Character {
  id: string;          // kebab-case identifier, e.g. 'fortune-teller'
  name: string;
  team: Team;
  ability: string;     // Short token text (exactly as printed)
  description: string; // Longer explanation for the reference page
}

export interface Player {
  id: string;
  room_id: string;
  display_name: string;
  is_host: boolean;
  seat_order: number;
  created_at: string;
}

export interface Session {
  playerId: string;
  roomId: string;
  isHost: boolean;
}
