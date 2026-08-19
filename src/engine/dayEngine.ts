/**
 * Day Engine — day-phase ability resolution
 *
 * Handles the four Trouble Brewing characters whose abilities fire during
 * the day phase rather than (or in addition to) at night:
 *
 *   Virgin  — First nomination by a Townsfolk: nominator is immediately executed.
 *   Saint   — Executed by the town: good team loses immediately.
 *   Slayer  — Publicly targets a player: if Demon, they die.
 *   Mayor   — If 3 players alive and no execution occurs: good team wins.
 *
 * All results are suggestions. The Storyteller remains the final authority and
 * may override any outcome.
 *
 * Design: pure functions, no side effects, no React or Supabase imports.
 */

import type { GameState } from './types';
import type { Player } from '../types';
import { getPlayerById, getAlivePlayerByRole, isDemon, hasToken, aliveCount, isAbilityImpaired } from './stateEngine';
import { TROUBLE_BREWING } from '../data/troubleBrewing';

// ── Output types ──────────────────────────────────────────────────────────────

export type DayAbilityType =
  | 'virgin-trigger'        // Virgin ability fired — nominator executed
  | 'virgin-no-trigger'     // Virgin nominated, but nominator was not Townsfolk
  | 'saint-loss'            // Saint executed — good team loses
  | 'slayer-hit'            // Slayer hit the Demon — Demon dies
  | 'slayer-miss'           // Slayer target was not the Demon
  | 'slayer-already-used'   // Slayer tried to fire but already used ability
  | 'mayor-win';            // Mayor condition met — 3 alive, no execution

export interface DayAbilityResult {
  type: DayAbilityType;
  /** Human-readable explanation for the Storyteller */
  message: string;
  /** Player IDs affected by this outcome */
  affectedPlayerIds: string[];
  /**
   * Whether this result changes game state (death, loss, win).
   * Advisory-only results like 'slayer-miss' are false.
   */
  isStateChange: boolean;
  /**
   * For kills/loss conditions: the Storyteller must confirm before applying.
   * Always true — every result is a suggestion, not automatic.
   */
  requiresConfirmation: true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTownsfolk(player: Player): boolean {
  const char = TROUBLE_BREWING.find((c) => c.id === player.role);
  return char?.team === 'townsfolk';
}

// ── Virgin ────────────────────────────────────────────────────────────────────

/**
 * Called when a player is nominated during the day.
 *
 * @param state       - Current game state
 * @param nomineeId   - Player who was nominated
 * @param nominatorId - Player who nominated them
 * @returns DayAbilityResult if the Virgin ability is in play and potentially triggered, null otherwise
 */
export function checkVirgin(
  state: GameState,
  nomineeId: string,
  nominatorId: string,
): DayAbilityResult | null {
  const virgin = getAlivePlayerByRole(state, 'virgin');
  if (!virgin || virgin.id !== nomineeId) return null; // Not Virgin or Virgin is not the nominee

  // Virgin ability is once-per-game — check if already used
  if (hasToken(state, virgin.id, 'virgin-ability-used')) {
    return null; // Already triggered; subsequent nominations don't fire it
  }

  const nominator = getPlayerById(state, nominatorId);
  if (!nominator) return null;

  // Virgin is poisoned → ability does not work
  if (isAbilityImpaired(state, virgin.id)) {
    return {
      type: 'virgin-no-trigger',
      message: `Virgin (${virgin.display_name}) is poisoned/drunk — their ability does not trigger.`,
      affectedPlayerIds: [virgin.id],
      isStateChange: false,
      requiresConfirmation: true,
    };
  }

  if (isTownsfolk(nominator)) {
    return {
      type: 'virgin-trigger',
      message: `Virgin ability triggered! ${nominator.display_name} (Townsfolk) nominated the Virgin — ${nominator.display_name} is immediately executed.`,
      affectedPlayerIds: [virgin.id, nominatorId],
      isStateChange: true,
      requiresConfirmation: true,
    };
  }

  // Spy can register as Townsfolk at the ST's discretion
  if (nominator.role === 'spy') {
    return {
      type: 'virgin-no-trigger',
      message: `Spy (${nominator.display_name}) nominated the Virgin. Spy is Minion by default — ability does not trigger. If you want Spy to register as Townsfolk tonight, execute ${nominator.display_name} manually.`,
      affectedPlayerIds: [virgin.id, nominatorId],
      isStateChange: false,
      requiresConfirmation: true,
    };
  }

  return {
    type: 'virgin-no-trigger',
    message: `${nominator.display_name} nominated the Virgin but is not Townsfolk — Virgin ability does not trigger.`,
    affectedPlayerIds: [virgin.id, nominatorId],
    isStateChange: false,
    requiresConfirmation: true,
  };
}

// ── Saint ─────────────────────────────────────────────────────────────────────

/**
 * Called when a player is executed.
 *
 * @returns DayAbilityResult if the executed player is the Saint, null otherwise
 */
export function checkSaint(
  state: GameState,
  executedPlayerId: string,
): DayAbilityResult | null {
  const saint = getAlivePlayerByRole(state, 'saint');
  if (!saint || saint.id !== executedPlayerId) return null;

  // Poisoned Saint: ability doesn't work — good team does NOT lose
  if (isAbilityImpaired(state, saint.id)) {
    return {
      type: 'saint-loss',
      message: `Saint (${saint.display_name}) was executed but is poisoned/drunk — their ability does not trigger. Good team does NOT lose.`,
      affectedPlayerIds: [saint.id],
      isStateChange: false,
      requiresConfirmation: true,
    };
  }

  return {
    type: 'saint-loss',
    message: `Saint (${saint.display_name}) was executed — the Good team loses immediately!`,
    affectedPlayerIds: [saint.id],
    isStateChange: true,
    requiresConfirmation: true,
  };
}

// ── Slayer ────────────────────────────────────────────────────────────────────

/**
 * Called when the Slayer publicly declares a target during the day.
 *
 * @returns DayAbilityResult describing what happens
 */
export function checkSlayer(
  state: GameState,
  slayerPlayerId: string,
  targetId: string,
): DayAbilityResult | null {
  const slayer = getPlayerById(state, slayerPlayerId);
  if (!slayer || slayer.role !== 'slayer' || !slayer.is_alive) return null;

  // Once-per-game check
  if (hasToken(state, slayerPlayerId, 'slayer-used')) {
    return {
      type: 'slayer-already-used',
      message: `${slayer.display_name} (Slayer) has already used their ability this game.`,
      affectedPlayerIds: [slayerPlayerId],
      isStateChange: false,
      requiresConfirmation: true,
    };
  }

  const target = getPlayerById(state, targetId);
  if (!target) return null;

  // Slayer poisoned → ability doesn't work (no kill even if Demon)
  if (isAbilityImpaired(state, slayerPlayerId)) {
    return {
      type: 'slayer-miss',
      message: `${slayer.display_name} (Slayer) is poisoned/drunk — their ability does not work. Nothing happens.`,
      affectedPlayerIds: [slayerPlayerId, targetId],
      isStateChange: false,
      requiresConfirmation: true,
    };
  }

  // Dead target: ability spent but nothing happens (can't kill an already-dead player)
  if (!target.is_alive) {
    return {
      type: 'slayer-miss',
      message: `${slayer.display_name} (Slayer) targets ${target.display_name}, who is already dead — nothing happens. Slayer ability is spent.`,
      affectedPlayerIds: [slayerPlayerId, targetId],
      isStateChange: false,
      requiresConfirmation: true,
    };
  }

  // Recluse can register as Demon at ST discretion
  if (target.role === 'recluse') {
    return {
      type: 'slayer-miss',
      message: `${slayer.display_name} (Slayer) targets the Recluse (${target.display_name}). Recluse is not the Demon — nothing happens. If you want Recluse to register as Demon, kill ${target.display_name} manually.`,
      affectedPlayerIds: [slayerPlayerId, targetId],
      isStateChange: false,
      requiresConfirmation: true,
    };
  }

  if (isDemon(state, targetId)) {
    return {
      type: 'slayer-hit',
      message: `${slayer.display_name} (Slayer) slays ${target.display_name} — they ARE the Demon! ${target.display_name} dies.`,
      affectedPlayerIds: [slayerPlayerId, targetId],
      isStateChange: true,
      requiresConfirmation: true,
    };
  }

  return {
    type: 'slayer-miss',
    message: `${slayer.display_name} (Slayer) targets ${target.display_name} — they are NOT the Demon. Nothing happens.`,
    affectedPlayerIds: [slayerPlayerId, targetId],
    isStateChange: false,
    requiresConfirmation: true,
  };
}

// ── Mayor ─────────────────────────────────────────────────────────────────────

/**
 * Check the Mayor's end-of-day win condition.
 * Called at the end of a day when no execution occurred.
 *
 * Condition: exactly 3 players alive AND no execution this day AND Mayor is alive.
 *
 * @returns DayAbilityResult if the win condition is met, null otherwise
 */
export function checkMayor(
  state: GameState,
  executionOccurred: boolean,
): DayAbilityResult | null {
  if (executionOccurred) return null;

  const mayor = getAlivePlayerByRole(state, 'mayor');
  if (!mayor) return null;

  const alive = aliveCount(state);
  if (alive !== 3) return null;

  // Poisoned Mayor: win condition does not trigger
  if (isAbilityImpaired(state, mayor.id)) {
    return null;
  }

  return {
    type: 'mayor-win',
    message: `Mayor win condition met! ${alive} players are alive, no execution occurred, and ${mayor.display_name} (Mayor) is one of them. Good team wins!`,
    affectedPlayerIds: [mayor.id],
    isStateChange: true,
    requiresConfirmation: true,
  };
}
