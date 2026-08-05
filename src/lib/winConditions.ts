/**
 * Win condition detection for Trouble Brewing.
 *
 * These are pure functions — no side effects, no Supabase calls.
 * Call them after any state change that could end the game.
 *
 * Conditions covered here (automatic):
 *   - Good wins:  All demons (Imp) are dead
 *   - Evil wins:  ≤2 players alive
 *
 * Conditions handled separately by dayEngine:
 *   - Saint executed → Evil wins  (checkSaint)
 *   - Mayor win check             (checkMayor)
 */

import type { Player } from '../types';
import { TROUBLE_BREWING } from '../data/troubleBrewing';

export interface WinDetection {
  outcome: 'good' | 'evil';
  reason: string;
}

/**
 * Evaluate automatic win conditions against the current player list.
 * Returns the first detected win, or null if the game continues.
 *
 * Evil-wins check runs before Good-wins so that a Demon killing the
 * last townsfolk (leaving ≤2 alive) is correctly attributed to Evil.
 */
export function detectWinCondition(players: Player[]): WinDetection | null {
  const alivePlayers = players.filter((p) => p.is_alive);

  // Evil wins: ≤2 players alive
  if (alivePlayers.length <= 2) {
    return {
      outcome: 'evil',
      reason:
        alivePlayers.length === 1
          ? 'Only 1 player remains alive — Evil wins!'
          : `Only ${alivePlayers.length} players remain alive — Evil wins!`,
    };
  }

  // Good wins: every demon is dead
  const demonPlayers = players.filter((p) => {
    const char = TROUBLE_BREWING.find((c) => c.id === p.role);
    return char?.team === 'demon';
  });

  if (demonPlayers.length > 0 && demonPlayers.every((p) => !p.is_alive)) {
    const names = demonPlayers.map((p) => p.display_name).join(', ');
    return {
      outcome: 'good',
      reason: `The Demon (${names}) is dead — Good wins!`,
    };
  }

  return null;
}

/**
 * Check if an executed player was the Saint (triggers Evil win).
 * Call this immediately after execution, before any other win checks.
 */
export function detectSaintExecution(
  players: Player[],
  executedPlayerId: string,
): WinDetection | null {
  const executed = players.find((p) => p.id === executedPlayerId);
  if (!executed) return null;

  // The executed player is the Saint (and wasn't Drunk/Poisoned —
  // that nuance is left to Narrator judgment via the "Continue Anyway" button)
  if (executed.role === 'saint') {
    return {
      outcome: 'evil',
      reason: `The Saint (${executed.display_name}) was executed — Evil wins!`,
    };
  }

  return null;
}
