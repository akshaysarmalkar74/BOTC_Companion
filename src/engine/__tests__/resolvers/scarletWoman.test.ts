import { describe, it, expect } from 'vitest';
import { ScarletWomanResolver } from '../../resolvers/scarletWoman';
import { makePlayer, makeToken, makeState } from '../helpers';
import { emptyResolution } from '../../types';

function makeCtx(
  players: ReturnType<typeof makePlayer>[],
  tokens: ReturnType<typeof makeToken>[] = [],
  impDying = true,
) {
  const imp = players.find((p) => p.role === 'imp')!;
  const resolution = emptyResolution();
  if (impDying && imp) resolution.deaths.add(imp.id);
  return {
    state: makeState(players, tokens),
    actions: {},
    resolution,
  };
}

function makePlayers(count: number) {
  const imp = makePlayer({ role: 'imp', id: 'imp-id', display_name: 'Imp' });
  const sw  = makePlayer({ role: 'scarlet-woman', id: 'sw-id', display_name: 'SW' });
  const rest = Array.from({ length: count - 2 }, (_, i) =>
    makePlayer({ role: 'empath', id: `p${i}`, display_name: `Player${i}` }),
  );
  return [imp, sw, ...rest];
}

describe('ScarletWomanResolver — standard succession (5+ alive)', () => {
  it('promotes SW to Imp when Imp dies with 5+ alive', () => {
    const players = makePlayers(6); // Imp + SW + 4 others = 6 alive; after Imp dies → 5
    const ctx    = makeCtx(players);
    const result = ScarletWomanResolver.resolve(ctx);

    expect(result.resolution.roleChanges.get('sw-id')).toBe('imp');
    expect(result.resolution.events.some((e) => e.type === 'transform')).toBe(true);
  });
});

describe('ScarletWomanResolver — fails below threshold', () => {
  it('does NOT promote SW when only 4 alive after Imp death', () => {
    const players = makePlayers(5); // 5 alive; after Imp dies → 4 (< 5 threshold)
    const ctx    = makeCtx(players);
    const result = ScarletWomanResolver.resolve(ctx);

    expect(result.resolution.roleChanges.has('sw-id')).toBe(false);
    expect(result.resolution.events.some((e) => e.description.includes('does NOT trigger'))).toBe(true);
  });
});

describe('ScarletWomanResolver — poisoned SW cannot succeed', () => {
  it('does NOT promote SW when she is poisoned (Case 3)', () => {
    const players = makePlayers(6);
    const poison  = makeToken('sw-id', 'poisoner-poisoned');
    const ctx     = makeCtx(players, [poison]);
    const result  = ScarletWomanResolver.resolve(ctx);

    expect(result.resolution.roleChanges.has('sw-id')).toBe(false);
    expect(result.resolution.events.some((e) => e.description.includes('poisoned/drunk'))).toBe(true);
  });
});

describe('ScarletWomanResolver — Imp not dying', () => {
  it('does nothing when Imp is not in the deaths set', () => {
    const players = makePlayers(6);
    const ctx     = makeCtx(players, [], false);
    const result  = ScarletWomanResolver.resolve(ctx);

    expect(result.resolution.roleChanges.size).toBe(0);
    expect(result.resolution.events.length).toBe(0);
  });
});

describe('ScarletWomanResolver — dead SW', () => {
  it('does nothing when SW is dead', () => {
    const imp = makePlayer({ role: 'imp', id: 'imp-id', display_name: 'Imp' });
    const sw  = makePlayer({ role: 'scarlet-woman', id: 'sw-id', display_name: 'SW', is_alive: false });
    const p1  = makePlayer({ role: 'empath', id: 'p1', display_name: 'P1' });
    const p2  = makePlayer({ role: 'empath', id: 'p2', display_name: 'P2' });
    const p3  = makePlayer({ role: 'empath', id: 'p3', display_name: 'P3' });
    const p4  = makePlayer({ role: 'empath', id: 'p4', display_name: 'P4' });

    const ctx    = makeCtx([imp, sw, p1, p2, p3, p4]);
    const result = ScarletWomanResolver.resolve(ctx);

    expect(result.resolution.roleChanges.has('sw-id')).toBe(false);
  });
});
