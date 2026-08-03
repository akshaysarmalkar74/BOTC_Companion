/**
 * Validation stage tests — targeting rules, once-per-game, duplicate targets
 */

import { describe, it, expect } from 'vitest';
import { makePlayer, makeToken, makeAction } from './helpers';
import { stageValidate } from '../validation';
import { emptyResolution } from '../types';
import type { GameState, PipelineContext } from '../types';

function makeCtx(
  players: ReturnType<typeof makePlayer>[],
  actionEntries: [string, ReturnType<typeof makeAction>][] = [],
  tokens: ReturnType<typeof makeToken>[] = [],
  nightNumber = 2,
): PipelineContext {
  const state: GameState = {
    roomId: 'room-1',
    players,
    reminderTokens: tokens,
    nightNumber,
    script: players.map((p) => p.role ?? '').filter(Boolean),
  };
  const actions = Object.fromEntries(actionEntries);
  return { state, actions, resolution: emptyResolution() };
}

describe('Validation — targeting rules', () => {
  it('warns when Butler targets themselves', () => {
    const butler = makePlayer({ role: 'butler', is_alive: true });
    const ctx    = makeCtx(
      [butler],
      [['butler', makeAction('butler', [butler.id])]],
    );
    const result = stageValidate(ctx);
    const types  = result.resolution.warnings.map((w) => w.type);
    expect(types).toContain('butler-self-target');
  });

  it('warns when Fortune Teller picks the same player twice', () => {
    const ft  = makePlayer({ role: 'fortune-teller', is_alive: true });
    const p2  = makePlayer({ role: 'chef',           is_alive: true });
    const ctx = makeCtx(
      [ft, p2],
      [['fortune-teller', makeAction('fortune-teller', [p2.id, p2.id])]],
    );
    const result = stageValidate(ctx);
    const types  = result.resolution.warnings.map((w) => w.type);
    expect(types).toContain('fortune-teller-duplicate-targets');
  });

  it('does not warn when Fortune Teller picks two different players', () => {
    const ft = makePlayer({ role: 'fortune-teller', is_alive: true });
    const p2 = makePlayer({ role: 'chef',           is_alive: true });
    const p3 = makePlayer({ role: 'imp',            is_alive: true });
    const ctx = makeCtx(
      [ft, p2, p3],
      [['fortune-teller', makeAction('fortune-teller', [p2.id, p3.id])]],
    );
    const result = stageValidate(ctx);
    const dupTypes = result.resolution.warnings.filter((w) => w.type === 'fortune-teller-duplicate-targets');
    expect(dupTypes).toHaveLength(0);
  });

  it('warns when Imp targets a dead player', () => {
    const imp  = makePlayer({ role: 'imp',   is_alive: true });
    const dead = makePlayer({ role: 'chef',  is_alive: false });
    const ctx  = makeCtx(
      [imp, dead],
      [['imp', makeAction('imp', [dead.id])]],
    );
    const result = stageValidate(ctx);
    const types  = result.resolution.warnings.map((w) => w.type);
    expect(types).toContain('imp-dead-target');
  });

  it('Imp is allowed to self-target (no warning)', () => {
    const imp = makePlayer({ role: 'imp', is_alive: true });
    const ctx = makeCtx(
      [imp],
      [['imp', makeAction('imp', [imp.id])]],
    );
    const result = stageValidate(ctx);
    const selfTypes = result.resolution.warnings.filter((w) => w.type === 'imp-self-target');
    expect(selfTypes).toHaveLength(0);
  });

  it('Monk self-target still caught (backward compat)', () => {
    const monk = makePlayer({ role: 'monk', is_alive: true });
    const ctx  = makeCtx(
      [monk],
      [['monk', makeAction('monk', [monk.id])]],
      [],
      2,
    );
    const result = stageValidate(ctx);
    const types  = result.resolution.warnings.map((w) => w.type);
    expect(types).toContain('monk-self-target');
  });
});

describe('Validation — once-per-game', () => {
  it('does not warn if slayer-used token absent', () => {
    const slayer = makePlayer({ role: 'slayer', is_alive: true });
    // Slayer has no night step, so no once-per-game validation fires here
    // (once-per-game is enforced by dayEngine for day abilities)
    const ctx = makeCtx([slayer], []);
    const result = stageValidate(ctx);
    expect(result.resolution.warnings.length).toBe(0);
  });
});
