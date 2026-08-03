import { describe, it, expect } from 'vitest';
import { MonkResolver } from '../../resolvers/monk';
import { makePlayer, makeToken, makeState, makeAction, makeActions } from '../helpers';
import { emptyResolution } from '../../types';

function makeCtx(players: ReturnType<typeof makePlayer>[], tokens: ReturnType<typeof makeToken>[] = [], actions = {}) {
  return {
    state: makeState(players, tokens),
    actions,
    resolution: emptyResolution(),
  };
}

describe('MonkResolver', () => {
  it('generates a protection event when Monk is healthy', () => {
    const monk   = makePlayer({ role: 'monk',   id: 'monk-id',   display_name: 'Monk' });
    const target = makePlayer({ role: 'empath', id: 'target-id', display_name: 'Alice' });
    const token  = makeToken(target.id, 'monk-protected');
    const action = makeAction('monk', [target.id]);

    const ctx = makeCtx([monk, target], [token], makeActions([action]));
    const result = MonkResolver.resolve(ctx);

    expect(result.resolution.events).toHaveLength(1);
    expect(result.resolution.events[0].type).toBe('protection');
    expect(result.resolution.events[0].description).toContain('Alice');
  });

  it('generates advisory event when Monk is poisoned', () => {
    const monk   = makePlayer({ role: 'monk',   id: 'monk-id',   display_name: 'Monk' });
    const target = makePlayer({ role: 'empath', id: 'target-id', display_name: 'Alice' });
    const protToken   = makeToken(target.id, 'monk-protected');
    const poisonToken = makeToken(monk.id,   'poisoner-poisoned');
    const action = makeAction('monk', [target.id]);

    const ctx = makeCtx([monk, target], [protToken, poisonToken], makeActions([action]));
    const result = MonkResolver.resolve(ctx);

    expect(result.resolution.events).toHaveLength(1);
    expect(result.resolution.events[0].type).toBe('advisory');
    expect(result.resolution.events[0].description).toContain('poisoned');
  });

  it('returns context unchanged when Monk is not in play', () => {
    const ctx = makeCtx([makePlayer({ role: 'empath' })]);
    const result = MonkResolver.resolve(ctx);
    expect(result.resolution.events).toHaveLength(0);
  });

  it('returns context unchanged when no action recorded', () => {
    const monk = makePlayer({ role: 'monk' });
    const ctx  = makeCtx([monk]);
    const result = MonkResolver.resolve(ctx);
    expect(result.resolution.events).toHaveLength(0);
  });
});
