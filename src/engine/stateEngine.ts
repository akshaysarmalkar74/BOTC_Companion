/**
 * State Engine — Layer 1
 *
 * Pure query functions over GameState. No side effects. No imports from React
 * or Supabase. Every function is independently unit-testable.
 *
 * Design principle: adding a new script (Bad Moon Rising, Sects & Violets)
 * should require extending this file at most minimally. Most additions live
 * in the resolver layer (Layer 2) and character metadata.
 */

import type { GameState } from './types';
import type { Player } from '../types';

// ── Evil role registry ───────────────────────────────────────────────────────
// Extend this set when adding new scripts. The State Engine does not need to
// know which script is active — it just checks role IDs.

const EVIL_ROLE_IDS = new Set([
  // Trouble Brewing
  'imp', 'poisoner', 'spy', 'scarlet-woman', 'baron',
]);

const DEMON_ROLE_IDS = new Set(['imp']);

// ── Player queries ────────────────────────────────────────────────────────────

export function getAlivePlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.is_alive);
}

export function getDeadPlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.is_alive);
}

export function getPlayerById(state: GameState, playerId: string): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

/**
 * Finds the first ALIVE player with the given role ID.
 * Returns undefined if the role is not in play or the player is dead.
 */
export function getAlivePlayerByRole(state: GameState, roleId: string): Player | undefined {
  return state.players.find((p) => p.role === roleId && p.is_alive);
}

/** Returns the player with the given role regardless of alive status */
export function getPlayerByRole(state: GameState, roleId: string): Player | undefined {
  return state.players.find((p) => p.role === roleId);
}

// ── Token queries ─────────────────────────────────────────────────────────────

export function hasToken(state: GameState, playerId: string, tokenKey: string): boolean {
  return state.reminderTokens.some(
    (t) => t.player_id === playerId && t.token_key === tokenKey,
  );
}

export function getTokensForPlayer(state: GameState, playerId: string) {
  return state.reminderTokens.filter((t) => t.player_id === playerId);
}

// ── Condition checks ──────────────────────────────────────────────────────────

/**
 * True if the player has a poisoner-poisoned reminder token.
 * The Night Assistant auto-places this token when the Poisoner step completes.
 */
export function isPoisoned(state: GameState, playerId: string): boolean {
  return hasToken(state, playerId, 'poisoner-poisoned');
}

/**
 * True if the player's ABILITY does not function correctly.
 * Covers both direct poisoning and the Drunk's inherent condition.
 */
export function isAbilityImpaired(state: GameState, playerId: string): boolean {
  if (isPoisoned(state, playerId)) return true;
  const player = getPlayerById(state, playerId);
  return player?.role === 'drunk';
}

/**
 * True if the Monk is protecting this player tonight AND the Monk's ability
 * is not impaired. A poisoned Monk cannot protect anyone.
 */
export function isMonkProtected(state: GameState, playerId: string): boolean {
  const monk = getPlayerByRole(state, 'monk');
  if (!monk?.is_alive) return false;
  if (isAbilityImpaired(state, monk.id)) return false;
  return hasToken(state, playerId, 'monk-protected');
}

/**
 * True if the player is the Soldier and their immunity is active.
 * A poisoned Soldier loses their Demon immunity.
 */
export function isSoldier(state: GameState, playerId: string): boolean {
  const player = getPlayerById(state, playerId);
  if (!player?.is_alive || player.role !== 'soldier') return false;
  return !isPoisoned(state, playerId);
}

/**
 * True if the player is the Mayor and their ability is not impaired.
 */
export function isMayor(state: GameState, playerId: string): boolean {
  const player = getPlayerById(state, playerId);
  if (!player?.is_alive || player.role !== 'mayor') return false;
  return !isAbilityImpaired(state, playerId);
}

/**
 * Returns the player ID of the Fortune Teller's Red Herring, or undefined
 * if no Red Herring has been assigned yet.
 */
export function getRedHerringPlayerId(state: GameState): string | undefined {
  return state.reminderTokens.find(
    (t) => t.token_key === 'fortune-teller-red-herring',
  )?.player_id;
}

// ── Alignment ─────────────────────────────────────────────────────────────────

export function isEvil(state: GameState, playerId: string): boolean {
  const player = getPlayerById(state, playerId);
  if (!player) return false;
  return EVIL_ROLE_IDS.has(player.role ?? '');
}

export function isDemon(state: GameState, playerId: string): boolean {
  const player = getPlayerById(state, playerId);
  if (!player) return false;
  return DEMON_ROLE_IDS.has(player.role ?? '');
}

// ── Seating ───────────────────────────────────────────────────────────────────

/**
 * Returns the two nearest ALIVE neighbours of a player around the circle,
 * sorted by seat_order. The circle wraps (first and last are adjacent).
 *
 * Returns [undefined, undefined] if the player is not found or is the only
 * alive player.
 */
export function getAliveNeighbors(
  state: GameState,
  playerId: string,
): [Player | undefined, Player | undefined] {
  const alive = getAlivePlayers(state).sort((a, b) => a.seat_order - b.seat_order);
  if (alive.length < 2) return [undefined, undefined];

  const idx = alive.findIndex((p) => p.id === playerId);
  if (idx === -1) return [undefined, undefined];

  const left  = alive[(idx - 1 + alive.length) % alive.length];
  const right = alive[(idx + 1) % alive.length];
  // Edge case: if there's exactly one other player, both sides are them
  return [left, right];
}

// ── Computed information ──────────────────────────────────────────────────────

/**
 * Counts pairs of adjacent evil players around the full seating circle.
 * A "pair" = two evil players in consecutive seats.
 * Used by the Chef resolution.
 */
export function countAdjacentEvilPairs(state: GameState): number {
  const seated = [...state.players].sort((a, b) => a.seat_order - b.seat_order);
  const n = seated.length;
  if (n < 2) return 0;

  let pairs = 0;
  for (let i = 0; i < n; i++) {
    const curr = seated[i];
    const next = seated[(i + 1) % n];
    if (isEvil(state, curr.id) && isEvil(state, next.id)) pairs++;
  }
  return pairs;
}

/**
 * Counts how many of a player's two nearest alive neighbours are evil.
 * Used by the Empath resolution.
 */
export function countEvilAliveNeighbors(state: GameState, playerId: string): number {
  const [left, right] = getAliveNeighbors(state, playerId);
  let count = 0;
  if (left  && isEvil(state, left.id))  count++;
  if (right && isEvil(state, right.id)) count++;
  return count;
}

/**
 * Returns how many players are alive (excluding host-flagged rows if any).
 */
export function aliveCount(state: GameState): number {
  return getAlivePlayers(state).length;
}

/**
 * Returns all alive Minion players.
 */
export function getAliveMinions(state: GameState): Player[] {
  const minionRoles = new Set(['poisoner', 'spy', 'scarlet-woman', 'baron']);
  return state.players.filter(
    (p) => p.is_alive && minionRoles.has(p.role ?? ''),
  );
}
