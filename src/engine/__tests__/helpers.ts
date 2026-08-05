/**
 * Test helpers — factories for GameState, Player, NightAction etc.
 * Keeps test files concise and focused on behaviour, not boilerplate.
 */

import type { GameState, NightActionMap } from '../types';
import type { Player, ReminderToken, NightAction } from '../../types';

let _idCounter = 0;
function nextId(): string {
  return `id-${++_idCounter}`;
}

// ── Player factory ────────────────────────────────────────────────────────────

export function makePlayer(overrides: Partial<Player> & { role: string }): Player {
  const base: Player = {
    id:              nextId(),
    room_id:         'room-1',
    display_name:    overrides.role,
    is_host:         false,
    seat_order:      1,
    role:            overrides.role,
    is_alive:        true,
    ghost_vote_used: false,
    notes:           '',
    created_at:      '2024-01-01T00:00:00Z',
    is_bot:          false,
    drunk_role:      null,
  };
  return { ...base, ...overrides };
}

// ── ReminderToken factory ──────────────────────────────────────────────────────

export function makeToken(
  playerId: string,
  tokenKey: string,
): ReminderToken {
  return {
    id:         nextId(),
    player_id:  playerId,
    room_id:    'room-1',
    token_key:  tokenKey,
    created_at: '2024-01-01T00:00:00Z',
  };
}

// ── NightAction factory ───────────────────────────────────────────────────────

export function makeAction(
  stepKey: string,
  targetIds: string[],
  nightNumber = 2,
): NightAction {
  return {
    id:           nextId(),
    room_id:      'room-1',
    night_number: nightNumber,
    step_key:     stepKey,
    target_ids:   targetIds,
    notes:        '',
    created_at:   '2024-01-01T00:00:00Z',
    updated_at:   '2024-01-01T00:00:00Z',
  };
}

// ── GameState factory ─────────────────────────────────────────────────────────

export function makeState(
  players: Player[],
  tokens: ReminderToken[] = [],
  nightNumber = 2,
  script?: string[],
  executedPlayerId?: string,
): GameState {
  return {
    roomId:          'room-1',
    players:         players.map((p, i) => ({
      ...p,
      seat_order: p.seat_order ?? i + 1,
    })),
    reminderTokens:  tokens,
    nightNumber,
    script:          script ?? players.map((p) => p.role).filter(Boolean) as string[],
    executedPlayerId,
  };
}

// ── Action map builder ────────────────────────────────────────────────────────

export function makeActions(actions: NightAction[]): NightActionMap {
  const map: NightActionMap = {};
  for (const a of actions) {
    map[a.step_key] = a;
  }
  return map;
}

// ── Seat helpers ──────────────────────────────────────────────────────────────

/** Assign seat_order 1..n to an array of players in place */
export function seat(players: Player[]): Player[] {
  return players.map((p, i) => ({ ...p, seat_order: i + 1 }));
}
