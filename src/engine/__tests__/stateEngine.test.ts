import { describe, it, expect } from 'vitest';
import {
  getAlivePlayers,
  getPlayerByRole,
  isPoisoned,
  isMonkProtected,
  isSoldier,
  isEvil,
  getAliveNeighbors,
  countAdjacentEvilPairs,
  countEvilAliveNeighbors,
  isAbilityImpaired,
  aliveCount,
} from '../stateEngine';
import { makePlayer, makeToken, makeState, seat } from './helpers';

// ── getAlivePlayers ───────────────────────────────────────────────────────────

describe('getAlivePlayers', () => {
  it('returns only alive players', () => {
    const alive = makePlayer({ role: 'monk', is_alive: true });
    const dead  = makePlayer({ role: 'imp',  is_alive: false });
    const state = makeState([alive, dead]);
    expect(getAlivePlayers(state)).toEqual([alive, dead].filter((p) => p.is_alive));
  });
});

// ── getPlayerByRole ───────────────────────────────────────────────────────────

describe('getPlayerByRole', () => {
  it('finds player by role', () => {
    const imp = makePlayer({ role: 'imp' });
    const state = makeState([imp]);
    expect(getPlayerByRole(state, 'imp')).toMatchObject({ role: 'imp' });
  });

  it('returns undefined for missing role', () => {
    const state = makeState([makePlayer({ role: 'monk' })]);
    expect(getPlayerByRole(state, 'imp')).toBeUndefined();
  });
});

// ── isPoisoned ────────────────────────────────────────────────────────────────

describe('isPoisoned', () => {
  it('returns true when poisoner-poisoned token exists', () => {
    const target = makePlayer({ role: 'empath' });
    const token  = makeToken(target.id, 'poisoner-poisoned');
    const state  = makeState([target], [token]);
    expect(isPoisoned(state, target.id)).toBe(true);
  });

  it('returns false without token', () => {
    const target = makePlayer({ role: 'empath' });
    const state  = makeState([target]);
    expect(isPoisoned(state, target.id)).toBe(false);
  });
});

// ── isAbilityImpaired ────────────────────────────────────────────────────────

describe('isAbilityImpaired', () => {
  it('returns true for poisoned player', () => {
    const player = makePlayer({ role: 'chef' });
    const token  = makeToken(player.id, 'poisoner-poisoned');
    const state  = makeState([player], [token]);
    expect(isAbilityImpaired(state, player.id)).toBe(true);
  });

  it('returns true for Drunk regardless of tokens', () => {
    const drunk = makePlayer({ role: 'drunk' });
    const state = makeState([drunk]);
    expect(isAbilityImpaired(state, drunk.id)).toBe(true);
  });

  it('returns false for healthy non-Drunk player', () => {
    const player = makePlayer({ role: 'chef' });
    const state  = makeState([player]);
    expect(isAbilityImpaired(state, player.id)).toBe(false);
  });
});

// ── isMonkProtected ───────────────────────────────────────────────────────────

describe('isMonkProtected', () => {
  it('returns true when token is present and Monk is healthy', () => {
    const monk   = makePlayer({ role: 'monk',   id: 'monk-id' });
    const target = makePlayer({ role: 'empath', id: 'target-id' });
    const token  = makeToken(target.id, 'monk-protected');
    const state  = makeState([monk, target], [token]);
    expect(isMonkProtected(state, target.id)).toBe(true);
  });

  it('returns false when Monk is poisoned', () => {
    const monk   = makePlayer({ role: 'monk',   id: 'monk-id' });
    const target = makePlayer({ role: 'empath', id: 'target-id' });
    const protToken   = makeToken(target.id, 'monk-protected');
    const poisonToken = makeToken(monk.id,   'poisoner-poisoned');
    const state = makeState([monk, target], [protToken, poisonToken]);
    expect(isMonkProtected(state, target.id)).toBe(false);
  });

  it('returns false when no token is present', () => {
    const monk   = makePlayer({ role: 'monk' });
    const target = makePlayer({ role: 'empath' });
    const state  = makeState([monk, target]);
    expect(isMonkProtected(state, target.id)).toBe(false);
  });

  it('returns false when Monk is dead', () => {
    const monk   = makePlayer({ role: 'monk',   is_alive: false });
    const target = makePlayer({ role: 'empath' });
    const token  = makeToken(target.id, 'monk-protected');
    const state  = makeState([monk, target], [token]);
    expect(isMonkProtected(state, target.id)).toBe(false);
  });
});

// ── isSoldier ─────────────────────────────────────────────────────────────────

describe('isSoldier', () => {
  it('returns true for alive, healthy Soldier', () => {
    const soldier = makePlayer({ role: 'soldier' });
    const state   = makeState([soldier]);
    expect(isSoldier(state, soldier.id)).toBe(true);
  });

  it('returns false for poisoned Soldier', () => {
    const soldier = makePlayer({ role: 'soldier' });
    const token   = makeToken(soldier.id, 'poisoner-poisoned');
    const state   = makeState([soldier], [token]);
    expect(isSoldier(state, soldier.id)).toBe(false);
  });

  it('returns false for dead Soldier', () => {
    const soldier = makePlayer({ role: 'soldier', is_alive: false });
    const state   = makeState([soldier]);
    expect(isSoldier(state, soldier.id)).toBe(false);
  });

  it('returns false for non-Soldier', () => {
    const player = makePlayer({ role: 'imp' });
    const state  = makeState([player]);
    expect(isSoldier(state, player.id)).toBe(false);
  });
});

// ── isEvil ────────────────────────────────────────────────────────────────────

describe('isEvil', () => {
  it('recognises all Trouble Brewing evil roles', () => {
    const evilRoles = ['imp', 'poisoner', 'spy', 'scarlet-woman', 'baron'];
    for (const role of evilRoles) {
      const player = makePlayer({ role });
      const state  = makeState([player]);
      expect(isEvil(state, player.id)).toBe(true);
    }
  });

  it('returns false for good roles', () => {
    const player = makePlayer({ role: 'monk' });
    const state  = makeState([player]);
    expect(isEvil(state, player.id)).toBe(false);
  });
});

// ── getAliveNeighbors ─────────────────────────────────────────────────────────

describe('getAliveNeighbors', () => {
  it('returns left and right neighbours in a 3-player circle', () => {
    const [alice, bob, carol] = seat([
      makePlayer({ role: 'empath',  display_name: 'Alice' }),
      makePlayer({ role: 'monk',    display_name: 'Bob'   }),
      makePlayer({ role: 'soldier', display_name: 'Carol' }),
    ]);
    const state = makeState([alice, bob, carol]);
    const [left, right] = getAliveNeighbors(state, bob.id);
    expect(left?.display_name).toBe('Alice');
    expect(right?.display_name).toBe('Carol');
  });

  it('wraps around at the ends', () => {
    const [alice, bob, carol] = seat([
      makePlayer({ role: 'empath',  display_name: 'Alice' }),
      makePlayer({ role: 'monk',    display_name: 'Bob'   }),
      makePlayer({ role: 'soldier', display_name: 'Carol' }),
    ]);
    const state = makeState([alice, bob, carol]);
    const [left, right] = getAliveNeighbors(state, alice.id);
    expect(left?.display_name).toBe('Carol'); // wraps
    expect(right?.display_name).toBe('Bob');
  });

  it('skips dead players', () => {
    const alice = makePlayer({ role: 'empath',  display_name: 'Alice', is_alive: true,  seat_order: 1 });
    const bob   = makePlayer({ role: 'monk',    display_name: 'Bob',   is_alive: false, seat_order: 2 }); // dead
    const carol = makePlayer({ role: 'soldier', display_name: 'Carol', is_alive: true,  seat_order: 3 });
    const state = makeState([alice, bob, carol]);
    const [left, right] = getAliveNeighbors(state, alice.id);
    // Bob is dead so alive neighbours are Alice↔Carol
    expect(left?.display_name).toBe('Carol');
    expect(right?.display_name).toBe('Carol');
  });
});

// ── countAdjacentEvilPairs ────────────────────────────────────────────────────

describe('countAdjacentEvilPairs', () => {
  it('returns 0 when no evil players are adjacent', () => {
    const players = seat([
      makePlayer({ role: 'monk'     }),
      makePlayer({ role: 'imp'      }),
      makePlayer({ role: 'soldier'  }),
      makePlayer({ role: 'poisoner' }),
    ]);
    // Seats: monk(1) imp(2) soldier(3) poisoner(4)
    // Adjacent evil pairs: imp–soldier? no. soldier–poisoner? no (soldier good). poisoner–monk? no.
    // Actually: imp(2)–soldier(3) no; poisoner(4)–monk(1) no. Only imp and poisoner aren't adjacent here.
    const state = makeState(players);
    expect(countAdjacentEvilPairs(state)).toBe(0);
  });

  it('counts adjacent evil pairs correctly', () => {
    const players = seat([
      makePlayer({ role: 'monk'     }),
      makePlayer({ role: 'imp'      }),
      makePlayer({ role: 'poisoner' }), // adjacent to imp
      makePlayer({ role: 'soldier'  }),
    ]);
    // imp(2)–poisoner(3) → 1 pair
    const state = makeState(players);
    expect(countAdjacentEvilPairs(state)).toBe(1);
  });

  it('counts wrap-around pair', () => {
    const players = seat([
      makePlayer({ role: 'imp'      }), // seat 1
      makePlayer({ role: 'monk'     }), // seat 2
      makePlayer({ role: 'poisoner' }), // seat 3 — adjacent to seat 1 via wrap
    ]);
    // wrap: poisoner(3) → imp(1) → 1 pair
    const state = makeState(players);
    expect(countAdjacentEvilPairs(state)).toBe(1);
  });
});

// ── countEvilAliveNeighbors ───────────────────────────────────────────────────

describe('countEvilAliveNeighbors', () => {
  it('returns 0 when both neighbours are good', () => {
    const [alice, bob, carol] = seat([
      makePlayer({ role: 'monk',    display_name: 'Alice' }),
      makePlayer({ role: 'empath',  display_name: 'Bob'   }),
      makePlayer({ role: 'soldier', display_name: 'Carol' }),
    ]);
    const state = makeState([alice, bob, carol]);
    expect(countEvilAliveNeighbors(state, bob.id)).toBe(0);
  });

  it('returns 1 when one neighbour is evil', () => {
    const [alice, bob, carol] = seat([
      makePlayer({ role: 'imp',    display_name: 'Alice' }),
      makePlayer({ role: 'empath', display_name: 'Bob'   }),
      makePlayer({ role: 'monk',   display_name: 'Carol' }),
    ]);
    const state = makeState([alice, bob, carol]);
    expect(countEvilAliveNeighbors(state, bob.id)).toBe(1);
  });

  it('returns 2 when both neighbours are evil', () => {
    const [alice, bob, carol] = seat([
      makePlayer({ role: 'imp',      display_name: 'Alice' }),
      makePlayer({ role: 'empath',   display_name: 'Bob'   }),
      makePlayer({ role: 'poisoner', display_name: 'Carol' }),
    ]);
    const state = makeState([alice, bob, carol]);
    expect(countEvilAliveNeighbors(state, bob.id)).toBe(2);
  });
});

// ── aliveCount ────────────────────────────────────────────────────────────────

describe('aliveCount', () => {
  it('counts correctly', () => {
    const players = [
      makePlayer({ role: 'monk',    is_alive: true  }),
      makePlayer({ role: 'imp',     is_alive: false }),
      makePlayer({ role: 'soldier', is_alive: true  }),
    ];
    const state = makeState(players);
    expect(aliveCount(state)).toBe(2);
  });
});
