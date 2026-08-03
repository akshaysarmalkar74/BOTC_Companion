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

// ── Game History (Phase 8) ──────────────────────────────────────────

/**
 * Every significant event type recorded to the game_events table.
 * Values are stable strings — never rename without a DB migration.
 */
export type GameEventType =
  | 'game_start'           // Game began, roles assigned
  | 'role_assigned'        // Individual role assignment
  | 'night_action'         // ST recorded an action during the night
  | 'resolution_death'     // Engine suggested a death
  | 'resolution_protection'// Engine noted a kill was blocked
  | 'resolution_poison'    // Engine noted a player was poisoned
  | 'resolution_transform' // Role change (Scarlet Woman → Imp)
  | 'resolution_info'      // Information given to an info role
  | 'resolution_advisory'  // Advisory/note from engine (no gameplay effect)
  | 'st_override'          // Storyteller changed the engine's suggestion
  | 'morning_announcement' // Who died (or nobody) at start of day
  | 'nomination'           // Player nominated during the day
  | 'execution'            // Player executed
  | 'player_death'         // Manual death toggle by Storyteller
  | 'ghost_vote_used'      // Ghost vote consumed
  | 'reminder_added'       // Reminder token placed
  | 'reminder_removed'     // Reminder token removed
  | 'day_note';            // Storyteller saved day notes

/**
 * A single row from the game_events table.
 *
 * metadata shapes by event_type:
 *   game_start       : { playerCount: number, script: string[] }
 *   role_assigned    : { roleId: string, roleName: string, team: string }
 *   night_action     : { stepKey: string, targetIds: string[], notes: string }
 *   st_override      : { field: 'death'|'roleChange', engineSuggested: unknown, stChoice: unknown }
 *   morning_announcement: { deaths: string[] }
 *   nomination       : { nominatorId: string, nomineeId: string }
 *   execution        : { playerId: string }
 *   day_note         : { notes: string }
 *   (others)         : {}
 */
export interface GameEvent {
  id: string;
  room_id: string;
  phase: string;
  event_type: GameEventType;
  description: string;
  affected_player_ids: string[];
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Export-ready snapshot of a completed game.
 * Shape is intentionally stable — future PDF/share features read this.
 */
export interface GameHistoryExport {
  exportedAt: string;
  room: { id: string; code: string; createdAt: string };
  script: string[];
  players: {
    id: string;
    name: string;
    role: string | null;
    isAlive: boolean;
    seatOrder: number;
  }[];
  phases: {
    phase: string;
    events: {
      type: GameEventType;
      description: string;
      affectedPlayerIds: string[];
      metadata: Record<string, unknown>;
      createdAt: string;
    }[];
  }[];
}
