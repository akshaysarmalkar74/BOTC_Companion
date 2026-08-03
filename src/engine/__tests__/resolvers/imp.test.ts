import { describe, it, expect } from 'vitest';
import { ImpResolver } from '../../resolvers/imp';
import { makePlayer, makeToken, makeState, makeAction, makeActions } from '../helpers';
import { emptyResolution } from '../../types';

function makeCtx(
  players: ReturnType<typeof makePlayer>[],
  tokens: ReturnType<typeof makeToken>[] = [],
  actions = {},
) {
  return {
    state: makeState(players, tokens),
    actions,
    resolution: emptyResolution(),
  };
}

describe('ImpResolver — standard kill', () => {
  it('adds target to deaths when no protection', () => {
    const imp    = makePlayer({ role: 'imp',   id: 'imp-id',    display_name: 'Imp' });
    const target = makePlayer({ role: 'empath', id: 'target-id', display_name: 'Alice' });
    const action = makeAction('imp', [target.id]);

    const ctx    = makeCtx([imp, target], [], makeActions([action]));
    const result = ImpResolver.resolve(ctx);

    expect(result.resolution.deaths.has(target.id)).toBe(true);
    expect(result.resolution.events[0].type).toBe('death');
  });
});

describe('ImpResolver — Soldier immunity', () => {
  it('does NOT add Soldier to deaths', () => {
    const imp     = makePlayer({ role: 'imp',     id: 'imp-id',  display_name: 'Imp' });
    const soldier = makePlayer({ role: 'soldier', id: 'sol-id',  display_name: 'Soldier' });
    const action  = makeAction('imp', [soldier.id]);

    const ctx    = makeCtx([imp, soldier], [], makeActions([action]));
    const result = ImpResolver.resolve(ctx);

    expect(result.resolution.deaths.has(soldier.id)).toBe(false);
    expect(result.resolution.events[0].type).toBe('protection');
  });

  it('kills poisoned Soldier', () => {
    const imp     = makePlayer({ role: 'imp',     id: 'imp-id', display_name: 'Imp' });
    const soldier = makePlayer({ role: 'soldier', id: 'sol-id', display_name: 'Soldier' });
    const poison  = makeToken(soldier.id, 'poisoner-poisoned');
    const action  = makeAction('imp', [soldier.id]);

    const ctx    = makeCtx([imp, soldier], [poison], makeActions([action]));
    const result = ImpResolver.resolve(ctx);

    expect(result.resolution.deaths.has(soldier.id)).toBe(true);
  });
});

describe('ImpResolver — Monk protection', () => {
  it('does NOT kill Monk-protected target', () => {
    const monk   = makePlayer({ role: 'monk',   id: 'monk-id',   display_name: 'Monk' });
    const imp    = makePlayer({ role: 'imp',    id: 'imp-id',    display_name: 'Imp' });
    const target = makePlayer({ role: 'empath', id: 'target-id', display_name: 'Alice' });
    const protToken = makeToken(target.id, 'monk-protected');
    const action    = makeAction('imp', [target.id]);

    const ctx    = makeCtx([monk, imp, target], [protToken], makeActions([action]));
    const result = ImpResolver.resolve(ctx);

    expect(result.resolution.deaths.has(target.id)).toBe(false);
    expect(result.resolution.events[0].type).toBe('protection');
  });

  it('kills target when Monk is poisoned (protection fails)', () => {
    const monk   = makePlayer({ role: 'monk',   id: 'monk-id',   display_name: 'Monk' });
    const imp    = makePlayer({ role: 'imp',    id: 'imp-id',    display_name: 'Imp' });
    const target = makePlayer({ role: 'empath', id: 'target-id', display_name: 'Alice' });
    const protToken   = makeToken(target.id, 'monk-protected');
    const poisonToken = makeToken(monk.id,   'poisoner-poisoned');
    const action      = makeAction('imp', [target.id]);

    const ctx    = makeCtx([monk, imp, target], [protToken, poisonToken], makeActions([action]));
    const result = ImpResolver.resolve(ctx);

    expect(result.resolution.deaths.has(target.id)).toBe(true);
  });
});

describe('ImpResolver — self-star', () => {
  it('adds Imp itself to deaths on self-target', () => {
    const imp    = makePlayer({ role: 'imp', id: 'imp-id', display_name: 'Imp' });
    const minion = makePlayer({ role: 'poisoner', id: 'min-id', display_name: 'Poisoner' });
    const action = makeAction('imp', [imp.id]);

    const ctx    = makeCtx([imp, minion], [], makeActions([action]));
    const result = ImpResolver.resolve(ctx);

    expect(result.resolution.deaths.has(imp.id)).toBe(true);
    expect(result.resolution.events[0].description).toContain('self-star');
  });
});

describe('ImpResolver — Mayor redirect advisory', () => {
  it('adds Mayor to deaths but emits redirect advisory', () => {
    const imp   = makePlayer({ role: 'imp',   id: 'imp-id',   display_name: 'Imp' });
    const mayor = makePlayer({ role: 'mayor', id: 'mayor-id', display_name: 'Mayor' });
    const action = makeAction('imp', [mayor.id]);

    const ctx    = makeCtx([imp, mayor], [], makeActions([action]));
    const result = ImpResolver.resolve(ctx);

    expect(result.resolution.deaths.has(mayor.id)).toBe(true);
    // Should have a death event AND an advisory event
    const types = result.resolution.events.map((e) => e.type);
    expect(types).toContain('death');
    expect(types).toContain('advisory');
  });
});

describe('ImpResolver — no action', () => {
  it('does nothing if no Imp action recorded', () => {
    const imp = makePlayer({ role: 'imp' });
    const ctx = makeCtx([imp]);
    const result = ImpResolver.resolve(ctx);
    expect(result.resolution.deaths.size).toBe(0);
  });
});
