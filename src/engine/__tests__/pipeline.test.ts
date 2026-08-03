import { describe, it, expect } from 'vitest';
import { resolveNight, buildActionMap } from '../pipeline';
import { makePlayer, makeToken, makeState, makeAction, seat } from './helpers';

// ── Full-pipeline integration tests ────────────────────────────────────────────
// Each test exercises the complete pipeline, not individual resolvers.

describe('Pipeline — no deaths', () => {
  it('produces "nobody died" summary when no Imp action recorded', () => {
    const imp = makePlayer({ role: 'imp', display_name: 'Imp' });
    const ftPlayer = makePlayer({ role: 'fortune-teller', display_name: 'FT' });
    const state = makeState([imp, ftPlayer]);
    const resolution = resolveNight(state, {});
    expect(resolution.deaths.size).toBe(0);
  });
});

describe('Pipeline — Monk protects, Imp attacks same target → no death', () => {
  it('blocks the Imp kill when Monk is healthy', () => {
    const monk   = makePlayer({ role: 'monk',   id: 'monk', display_name: 'Monk' });
    const imp    = makePlayer({ role: 'imp',    id: 'imp',  display_name: 'Imp'  });
    const target = makePlayer({ role: 'empath', id: 'tgt',  display_name: 'Alice' });
    const protToken = makeToken(target.id, 'monk-protected');

    const state = makeState([monk, imp, target], [protToken]);
    const actions = buildActionMap([
      makeAction('monk', [target.id]),
      makeAction('imp',  [target.id]),
    ]);

    const resolution = resolveNight(state, actions);
    expect(resolution.deaths.has(target.id)).toBe(false);
    const protEvent = resolution.events.find((e) => e.type === 'protection');
    expect(protEvent).toBeDefined();
  });
});

describe('Pipeline — poisoned Monk, Imp attacks → target dies', () => {
  it('kills target when Monk protection fails due to poison', () => {
    const monk   = makePlayer({ role: 'monk',   id: 'monk', display_name: 'Monk' });
    const imp    = makePlayer({ role: 'imp',    id: 'imp',  display_name: 'Imp'  });
    const target = makePlayer({ role: 'empath', id: 'tgt',  display_name: 'Alice' });
    const protToken   = makeToken(target.id, 'monk-protected');
    const poisonToken = makeToken(monk.id,   'poisoner-poisoned');

    const state = makeState([monk, imp, target], [protToken, poisonToken]);
    const actions = buildActionMap([
      makeAction('poisoner', [monk.id]),
      makeAction('monk',     [target.id]),
      makeAction('imp',      [target.id]),
    ]);

    const resolution = resolveNight(state, actions);
    expect(resolution.deaths.has(target.id)).toBe(true);
  });
});

describe('Pipeline — Soldier survives Imp attack', () => {
  it('does not add Soldier to deaths', () => {
    const imp     = makePlayer({ role: 'imp',     id: 'imp', display_name: 'Imp' });
    const soldier = makePlayer({ role: 'soldier', id: 'sol', display_name: 'Soldier' });
    const state   = makeState([imp, soldier]);
    const actions = buildActionMap([makeAction('imp', [soldier.id])]);

    const resolution = resolveNight(state, actions);
    expect(resolution.deaths.has(soldier.id)).toBe(false);
  });
});

describe('Pipeline — Imp self-star triggers Scarlet Woman succession', () => {
  it('Imp dies, SW becomes Imp when 5+ alive', () => {
    const imp = makePlayer({ role: 'imp',          id: 'imp', display_name: 'Imp' });
    const sw  = makePlayer({ role: 'scarlet-woman', id: 'sw',  display_name: 'SW'  });
    const p3  = makePlayer({ role: 'monk',          id: 'p3',  display_name: 'P3'  });
    const p4  = makePlayer({ role: 'empath',        id: 'p4',  display_name: 'P4'  });
    const p5  = makePlayer({ role: 'soldier',       id: 'p5',  display_name: 'P5'  });
    const p6  = makePlayer({ role: 'chef',          id: 'p6',  display_name: 'P6'  });

    const state   = makeState(seat([imp, sw, p3, p4, p5, p6]));
    const actions = buildActionMap([makeAction('imp', [imp.id])]);

    const resolution = resolveNight(state, actions);

    expect(resolution.deaths.has(imp.id)).toBe(true);
    expect(resolution.roleChanges.get(sw.id)).toBe('imp');

    const transformEvent = resolution.events.find((e) => e.type === 'transform');
    expect(transformEvent).toBeDefined();
    expect(transformEvent?.description).toContain('SW');
  });

  it('SW does NOT succeed when fewer than 5 alive', () => {
    const imp = makePlayer({ role: 'imp',          id: 'imp', display_name: 'Imp' });
    const sw  = makePlayer({ role: 'scarlet-woman', id: 'sw',  display_name: 'SW'  });
    const p3  = makePlayer({ role: 'monk',          id: 'p3',  display_name: 'P3'  });
    const p4  = makePlayer({ role: 'empath',        id: 'p4',  display_name: 'P4'  });

    // 4 alive total; after Imp dies = 3 (below threshold of 5)
    const state   = makeState(seat([imp, sw, p3, p4]));
    const actions = buildActionMap([makeAction('imp', [imp.id])]);

    const resolution = resolveNight(state, actions);

    expect(resolution.deaths.has(imp.id)).toBe(true);
    expect(resolution.roleChanges.has(sw.id)).toBe(false);
  });
});

describe('Pipeline — Ravenkeeper triggered on death', () => {
  it('generates trigger event and info suggestion when RK dies', () => {
    const imp = makePlayer({ role: 'imp',         id: 'imp', display_name: 'Imp' });
    const rk  = makePlayer({ role: 'ravenkeeper', id: 'rk',  display_name: 'RK'  });
    const p3  = makePlayer({ role: 'monk',        id: 'p3',  display_name: 'Monk' });

    const state = makeState([imp, rk, p3]);
    const actions = buildActionMap([
      makeAction('imp',          [rk.id]),  // Imp kills RK
      makeAction('ravenkeeper',  [p3.id]),  // RK chooses Monk
    ]);

    const resolution = resolveNight(state, actions);

    expect(resolution.deaths.has(rk.id)).toBe(true);
    const triggerEvent = resolution.events.find((e) => e.type === 'trigger');
    expect(triggerEvent).toBeDefined();
    expect(triggerEvent?.description).toContain('Monk');

    const infoSugg = resolution.infoSuggestions.find(
      (s) => s.characterId === 'ravenkeeper',
    );
    expect(infoSugg?.abilityWorking).toBe(true);
  });
});

describe('Pipeline — Fortune Teller with Red Herring', () => {
  it('suggests YES when one of the two targets is the Red Herring', () => {
    const imp  = makePlayer({ role: 'imp',           id: 'imp', display_name: 'Imp' });
    const ft   = makePlayer({ role: 'fortune-teller', id: 'ft',  display_name: 'FT'  });
    const rh   = makePlayer({ role: 'monk',           id: 'rh',  display_name: 'RedHerring' });
    const good = makePlayer({ role: 'chef',           id: 'g',   display_name: 'Good' });

    const rhToken = makeToken(rh.id, 'fortune-teller-red-herring');
    const state   = makeState([imp, ft, rh, good], [rhToken]);
    const actions = buildActionMap([makeAction('fortune-teller', [rh.id, good.id])]);

    const resolution = resolveNight(state, actions);

    const ftSugg = resolution.infoSuggestions.find(
      (s) => s.characterId === 'fortune-teller',
    );
    expect(ftSugg?.suggestion).toContain('YES');
  });

  it('suggests NO when neither target is Demon or Red Herring', () => {
    const imp  = makePlayer({ role: 'imp',           id: 'imp', display_name: 'Imp' });
    const ft   = makePlayer({ role: 'fortune-teller', id: 'ft',  display_name: 'FT'  });
    const rh   = makePlayer({ role: 'chef',           id: 'rh',  display_name: 'Chef1' });
    const good = makePlayer({ role: 'monk',           id: 'g',   display_name: 'Monk' });

    // Red Herring is someone else entirely (not in query)
    const state   = makeState([imp, ft, rh, good]);
    const actions = buildActionMap([makeAction('fortune-teller', [rh.id, good.id])]);

    const resolution = resolveNight(state, actions);

    const ftSugg = resolution.infoSuggestions.find(
      (s) => s.characterId === 'fortune-teller',
    );
    expect(ftSugg?.suggestion).toContain('NO');
  });
});

describe('Pipeline — Undertaker', () => {
  it('suggests showing executed player role on Night 2+', () => {
    const ut      = makePlayer({ role: 'undertaker', id: 'ut',  display_name: 'UT' });
    const imp     = makePlayer({ role: 'imp',        id: 'imp', display_name: 'Imp' });
    const victim  = makePlayer({ role: 'monk',       id: 'v',   display_name: 'Victim', is_alive: false });

    const state = makeState([ut, imp, victim], [], 2, undefined, victim.id);
    const resolution = resolveNight(state, {});

    const utSugg = resolution.infoSuggestions.find(
      (s) => s.characterId === 'undertaker',
    );
    expect(utSugg).toBeDefined();
    expect(utSugg?.suggestion).toContain('Monk');
  });
});

describe('Pipeline — validation warnings', () => {
  it('warns about duplicate roles', () => {
    const a = makePlayer({ role: 'monk', display_name: 'A' });
    const b = makePlayer({ role: 'monk', display_name: 'B' });
    const state = makeState([a, b]);
    const resolution = resolveNight(state, {});
    const dupe = resolution.warnings.find((w) => w.type === 'duplicate-role');
    expect(dupe).toBeDefined();
    expect(dupe?.severity).toBe('error');
  });

  it('warns about Imp action on Night 1', () => {
    const imp = makePlayer({ role: 'imp', id: 'imp', display_name: 'Imp' });
    const target = makePlayer({ role: 'monk', id: 'tgt', display_name: 'Monk' });
    const state = makeState([imp, target], [], 1);
    const actions = buildActionMap([makeAction('imp', [target.id], 1)]);
    const resolution = resolveNight(state, actions);
    const warn = resolution.warnings.find((w) => w.type === 'imp-night1');
    expect(warn).toBeDefined();
  });
});

describe('Pipeline — Empath information', () => {
  it('suggests correct evil neighbour count', () => {
    const [imp, empath, good] = seat([
      makePlayer({ role: 'imp',    id: 'imp', display_name: 'Imp' }),
      makePlayer({ role: 'empath', id: 'em',  display_name: 'Empath' }),
      makePlayer({ role: 'monk',   id: 'g',   display_name: 'Monk' }),
    ]);
    // Circle: Imp(1)–Empath(2)–Monk(3), wraps Monk→Imp
    // Empath neighbours: Imp (evil) and Monk (good) → 1 evil neighbour
    const state = makeState([imp, empath, good]);
    const resolution = resolveNight(state, {});

    const empSugg = resolution.infoSuggestions.find(
      (s) => s.characterId === 'empath',
    );
    expect(empSugg?.suggestion).toContain('1');
  });
});
