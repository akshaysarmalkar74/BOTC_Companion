/**
 * Official Trouble Brewing player-count setup table.
 * Source: Blood on the Clocktower rulebook.
 *
 * Each entry defines the exact character counts required for that
 * player count. The Demon count is always 1 in Trouble Brewing.
 *
 * Baron exception: selecting the Baron shifts 2 Townsfolk → 2 Outsiders.
 * Use getSetup() to get the effective counts for a given selection.
 */
export interface SetupCounts {
  players: number;
  townsfolk: number;
  outsiders: number;
  minions: number;
  demons: number;
}

export const SETUP_TABLE: SetupCounts[] = [
  { players: 5,  townsfolk: 3, outsiders: 0, minions: 1, demons: 1 },
  { players: 6,  townsfolk: 3, outsiders: 1, minions: 1, demons: 1 },
  { players: 7,  townsfolk: 5, outsiders: 0, minions: 1, demons: 1 },
  { players: 8,  townsfolk: 5, outsiders: 1, minions: 1, demons: 1 },
  { players: 9,  townsfolk: 5, outsiders: 2, minions: 1, demons: 1 },
  { players: 10, townsfolk: 7, outsiders: 0, minions: 2, demons: 1 },
  { players: 11, townsfolk: 7, outsiders: 1, minions: 2, demons: 1 },
  { players: 12, townsfolk: 7, outsiders: 2, minions: 2, demons: 1 },
  { players: 13, townsfolk: 9, outsiders: 0, minions: 3, demons: 1 },
  { players: 14, townsfolk: 9, outsiders: 1, minions: 3, demons: 1 },
  { players: 15, townsfolk: 9, outsiders: 2, minions: 3, demons: 1 },
];

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 15;

/**
 * Returns the effective required counts for a given player count,
 * adjusted for the Baron (which swaps 2 Townsfolk for 2 Outsiders).
 * Returns null if playerCount is outside the supported range.
 */
export function getSetup(playerCount: number, hasBaron: boolean): SetupCounts | null {
  const base = SETUP_TABLE.find((s) => s.players === playerCount);
  if (!base) return null;
  return {
    players: playerCount,
    townsfolk: base.townsfolk - (hasBaron ? 2 : 0),
    outsiders: base.outsiders + (hasBaron ? 2 : 0),
    minions: base.minions,
    demons: base.demons,
  };
}
