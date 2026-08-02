export type RoomStatus = 'lobby' | 'in_progress';

export interface Room {
  id: string;
  code: string;
  host_id: string | null;
  script: string[];      // array of character IDs — added Phase 2
  status: RoomStatus;    // game lifecycle state — added Phase 3
  phase: string;              // e.g. "Night 1", "Day 2" — added Phase 4
  night_step_key: string | null; // current Night Assistant step — Phase 5
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
  role: string | null;        // character ID — assigned Phase 3, null until then
  is_alive: boolean;          // alive/dead state — Phase 4
  ghost_vote_used: boolean;   // ghost vote consumed — Phase 4
  notes: string;              // Storyteller-only notes — Phase 4
  created_at: string;
}

/**
 * A single event recorded during the day phase.
 * payload shape per event_type:
 *   nomination: { nominator_id: string, nominee_id: string }
 *   execution:  { player_id: string }
 */
export interface DayEvent {
  id: string;
  room_id: string;
  day_number: number;
  event_type: 'nomination' | 'execution';
  payload: Record<string, string>;
  created_at: string;
}

/** Storyteller private notes for one day (one row per room per day). */
export interface DayNote {
  id: string;
  room_id: string;
  day_number: number;
  notes: string;
  updated_at: string;
}

export interface NightAction {
  id: string;
  room_id: string;
  night_number: number;
  step_key: string;
  target_ids: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ReminderToken {
  id: string;
  player_id: string;
  room_id: string;
  token_key: string;    // references ReminderTokenDef.key
  created_at: string;
}

export interface Session {
  playerId: string;
  roomId: string;
  isHost: boolean;
}
