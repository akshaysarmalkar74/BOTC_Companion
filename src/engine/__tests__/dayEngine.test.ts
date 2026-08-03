/**
 * Day engine tests — Virgin, Saint, Slayer, Mayor
 */

import { describe, it, expect } from 'vitest';
import { makePlayer, makeToken } from './helpers';
import { checkVirgin, checkSaint, checkSlayer, checkMayor } from '../dayEngine';
import type { GameState } from '../types';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId:         'room-1',
    players:        [],
    reminderTokens: [],
    nightNumber:    2,
    script:         [],
    ...overrides,
  };
}

// ── Virgin ─────────────────────────────────────────────────────────────────────

describe('checkVirgin', () => {
  it('triggers when a Townsfolk nominates the Virgin', () => {
    const virgin    = makePlayer({ role: 'virgin', is_alive: true });
    const nominator = makePlayer({ role: 'chef',   is_alive: true });
    const state = makeState({ players: [virgin, nominator] });

    const result = checkVirgin(state, virgin.id, nominator.id);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('virgin-trigger');
    expect(result!.isStateChange).toBe(true);
    expect(result!.affectedPlayerIds).toContain(nominator.id);
  });

  it('does not trigger when nominator is a Minion', () => {
    const virgin    = makePlayer({ role: 'virgin',   is_alive: true });
    const nominator = makePlayer({ role: 'poisoner', is_alive: true });
    const state = makeState({ players: [virgin, nominator] });

    const result = checkVirgin(state, virgin.id, nominator.id);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('virgin-no-trigger');
    expect(result!.isStateChange).toBe(false);
  });

  it('returns null when nominee is not the Virgin', () => {
    const virgin    = makePlayer({ role: 'virgin', is_alive: true });
    const other     = makePlayer({ role: 'chef',   is_alive: true });
    const nominator = makePlayer({ role: 'empath', is_alive: true });
    const state = makeState({ players: [virgin, other, nominator] });

    expect(checkVirgin(state, other.id, nominator.id)).toBeNull();
  });

  it('does not trigger when Virgin ability already used', () => {
    const virgin    = makePlayer({ role: 'virgin', is_alive: true });
    const nominator = makePlayer({ role: 'chef',   is_alive: true });
    const usedToken = makeToken(virgin.id, 'virgin-ability-used');
    const state = makeState({ players: [virgin, nominator], reminderTokens: [usedToken] });

    expect(checkVirgin(state, virgin.id, nominator.id)).toBeNull();
  });

  it('does not trigger when Virgin is poisoned', () => {
    const virgin    = makePlayer({ role: 'virgin', is_alive: true });
    const nominator = makePlayer({ role: 'chef',   is_alive: true });
    const poison    = makeToken(virgin.id, 'poisoner-poisoned');
    const state = makeState({ players: [virgin, nominator], reminderTokens: [poison] });

    const result = checkVirgin(state, virgin.id, nominator.id);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('virgin-no-trigger');
  });
});

// ── Saint ──────────────────────────────────────────────────────────────────────

describe('checkSaint', () => {
  it('returns saint-loss when Saint is executed', () => {
    const saint = makePlayer({ role: 'saint', is_alive: true });
    const state = makeState({ players: [saint] });

    const result = checkSaint(state, saint.id);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('saint-loss');
    expect(result!.isStateChange).toBe(true);
  });

  it('returns null when executed player is not the Saint', () => {
    const saint = makePlayer({ role: 'saint', is_alive: true });
    const other = makePlayer({ role: 'mayor', is_alive: true });
    const state = makeState({ players: [saint, other] });

    expect(checkSaint(state, other.id)).toBeNull();
  });

  it('returns non-state-change when Saint is poisoned', () => {
    const saint  = makePlayer({ role: 'saint', is_alive: true });
    const poison = makeToken(saint.id, 'poisoner-poisoned');
    const state  = makeState({ players: [saint], reminderTokens: [poison] });

    const result = checkSaint(state, saint.id);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('saint-loss');
    expect(result!.isStateChange).toBe(false); // poisoned → ability fails
  });
});

// ── Slayer ─────────────────────────────────────────────────────────────────────

describe('checkSlayer', () => {
  it('hits when Slayer targets the Demon', () => {
    const slayer = makePlayer({ role: 'slayer', is_alive: true });
    const imp    = makePlayer({ role: 'imp',    is_alive: true });
    const state  = makeState({ players: [slayer, imp] });

    const result = checkSlayer(state, slayer.id, imp.id);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('slayer-hit');
    expect(result!.isStateChange).toBe(true);
  });

  it('misses when Slayer targets a non-Demon', () => {
    const slayer   = makePlayer({ role: 'slayer', is_alive: true });
    const innocent = makePlayer({ role: 'empath', is_alive: true });
    const imp      = makePlayer({ role: 'imp',    is_alive: true });
    const state    = makeState({ players: [slayer, innocent, imp] });

    const result = checkSlayer(state, slayer.id, innocent.id);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('slayer-miss');
    expect(result!.isStateChange).toBe(false);
  });

  it('returns already-used when slayer-used token present', () => {
    const slayer = makePlayer({ role: 'slayer', is_alive: true });
    const imp    = makePlayer({ role: 'imp',    is_alive: true });
    const used   = makeToken(slayer.id, 'slayer-used');
    const state  = makeState({ players: [slayer, imp], reminderTokens: [used] });

    const result = checkSlayer(state, slayer.id, imp.id);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('slayer-already-used');
    expect(result!.isStateChange).toBe(false);
  });

  it('misses even on Demon when Slayer is poisoned', () => {
    const slayer = makePlayer({ role: 'slayer', is_alive: true });
    const imp    = makePlayer({ role: 'imp',    is_alive: true });
    const poison = makeToken(slayer.id, 'poisoner-poisoned');
    const state  = makeState({ players: [slayer, imp], reminderTokens: [poison] });

    const result = checkSlayer(state, slayer.id, imp.id);
    expect(result!.type).toBe('slayer-miss');
  });
});

// ── Mayor ──────────────────────────────────────────────────────────────────────

describe('checkMayor', () => {
  it('triggers when 3 players alive and no execution', () => {
    const mayor = makePlayer({ role: 'mayor',  is_alive: true });
    const p1    = makePlayer({ role: 'empath', is_alive: true });
    const p2    = makePlayer({ role: 'imp',    is_alive: true });
    const state = makeState({ players: [mayor, p1, p2] });

    const result = checkMayor(state, false);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('mayor-win');
    expect(result!.isStateChange).toBe(true);
  });

  it('returns null when an execution occurred', () => {
    const mayor = makePlayer({ role: 'mayor',  is_alive: true });
    const p1    = makePlayer({ role: 'empath', is_alive: true });
    const p2    = makePlayer({ role: 'imp',    is_alive: true });
    const state = makeState({ players: [mayor, p1, p2] });

    expect(checkMayor(state, true)).toBeNull();
  });

  it('returns null when more than 3 alive', () => {
    const mayor = makePlayer({ role: 'mayor',  is_alive: true });
    const p1    = makePlayer({ role: 'empath', is_alive: true });
    const p2    = makePlayer({ role: 'imp',    is_alive: true });
    const p3    = makePlayer({ role: 'chef',   is_alive: true });
    const state = makeState({ players: [mayor, p1, p2, p3] });

    expect(checkMayor(state, false)).toBeNull();
  });

  it('returns null when Mayor not in play', () => {
    const p1 = makePlayer({ role: 'empath', is_alive: true });
    const p2 = makePlayer({ role: 'imp',    is_alive: true });
    const p3 = makePlayer({ role: 'chef',   is_alive: true });
    const state = makeState({ players: [p1, p2, p3] });

    expect(checkMayor(state, false)).toBeNull();
  });

  it('returns null when Mayor is poisoned', () => {
    const mayor  = makePlayer({ role: 'mayor',  is_alive: true });
    const p1     = makePlayer({ role: 'empath', is_alive: true });
    const p2     = makePlayer({ role: 'imp',    is_alive: true });
    const poison = makeToken(mayor.id, 'poisoner-poisoned');
    const state  = makeState({ players: [mayor, p1, p2], reminderTokens: [poison] });

    expect(checkMayor(state, false)).toBeNull();
  });
});
