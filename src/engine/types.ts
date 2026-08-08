/**
 * Engine types — the shared language between the State Engine (Layer 1)
 * and the Role Resolver layer (Layer 2).
 *
 * Nothing in this file imports from React, Supabase, or any UI layer.
 * The engine is independently testable and future-script-agnostic.
 */

import type { Player, ReminderToken, NightAction } from '../types';

// ── Game State ───────────────────────────────────────────────────────────────

/**
 * A snapshot of all game data at the moment the engine is invoked.
 * The engine never mutates this — it only reads from it.
 */
export interface GameState {
  roomId: string;
  /** All non-host players, ordered by seat_order */
  players: Player[];
  /** All active reminder tokens for this room */
  reminderTokens: ReminderToken[];
  /** Which night is being resolved (1-indexed) */
  nightNumber: number;
  /** Character IDs included in the current script */
  script: string[];
  /**
   * Player who was executed during today's day phase, if any.
   * Undertaker uses this to learn the executed role tonight.
   */
  executedPlayerId?: string;
  /**
   * The role the executed player held AT THE TIME of execution (snapshotted in
   * day_events payload). Prevents stale reads if the player's role was later
   * changed (e.g. post-hoc SW succession toggle).
   */
  executedPlayerRole?: string;
}

/** All night actions for one night, keyed by step_key */
export type NightActionMap = Record<string, NightAction>;

// ── Resolution Output ────────────────────────────────────────────────────────

export type EventType =
  | 'death'        // A player died
  | 'protection'   // A kill was blocked
  | 'poison'       // A player was poisoned (ability malfunctions)
  | 'transform'    // A player's role changed (Scarlet Woman, Imp self-star)
  | 'info'         // Information a role would receive tonight
  | 'trigger'      // An ability triggered in response to another event
  | 'advisory';    // Informational note for the Storyteller

export interface ResolutionEvent {
  id: string;
  type: EventType;
  description: string;
  /** IDs of players directly involved in this event */
  affectedPlayerIds: string[];
}

export type WarningSeverity = 'error' | 'warning';

export interface ValidationWarning {
  /** Machine-readable category */
  type: string;
  /** Human-readable description */
  message: string;
  severity: WarningSeverity;
}

/**
 * The rule engine's output — a set of suggestions and events.
 *
 * Every field represents what the engine SUGGESTS. The Storyteller may
 * override any decision before committing to the database.
 *
 * deaths and roleChanges are mutable so pipeline stages can accumulate them.
 */
export interface NightResolution {
  /** Player IDs the engine suggests should die tonight */
  deaths: Set<string>;
  /** Role changes: playerId → new character ID (e.g. Scarlet Woman → imp) */
  roleChanges: Map<string, string>;
  /** Suggested information the ST should give to each info role */
  infoSuggestions: InfoSuggestion[];
  /** Human-readable events explaining every resolution step */
  events: ResolutionEvent[];
  /** Short advisory sentences for the ST's resolution summary panel */
  suggestions: string[];
  /** Problems detected; shown as warnings, never silently ignored */
  warnings: ValidationWarning[];
}

export interface InfoSuggestion {
  /** Character ID of the role receiving the info */
  characterId: string;
  /** Player ID of the role receiving the info */
  playerId: string;
  /** Whether this player's ability is working correctly */
  abilityWorking: boolean;
  /** The suggested answer/information the ST should communicate */
  suggestion: string;
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Mutable context threaded through every pipeline stage.
 * Each stage receives the context, modifies resolution, and passes it forward.
 */
export interface PipelineContext {
  state: GameState;
  actions: NightActionMap;
  resolution: NightResolution;
}

/** A single pipeline stage: pure function that enriches the context */
export type PipelineStage = (ctx: PipelineContext) => PipelineContext;

// ── Factories ─────────────────────────────────────────────────────────────────

export function emptyResolution(): NightResolution {
  return {
    deaths: new Set(),
    roleChanges: new Map(),
    infoSuggestions: [],
    events: [],
    suggestions: [],
    warnings: [],
  };
}

let _eventCounter = 0;
export function makeEventId(): string {
  return `evt-${++_eventCounter}-${Date.now()}`;
}
