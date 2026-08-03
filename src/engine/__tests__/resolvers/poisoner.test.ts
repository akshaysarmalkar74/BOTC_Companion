import { describe, it, expect } from 'vitest';
import { PoisonerResolver } from '../../resolvers/poisoner';
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

describe('PoisonerResolver', () => {
  it('generates a poison event when Poisoner acted', () => {
    const poisoner = makePlayer({ role: 'poisoner', id: 'pos-id', display_name: 'Poisoner' });
    const target   = makePlayer({ role: 'monk',     id: 'tgt-id', display_name: 'Alice' });
    const token    = makeToken(target.id, 'poisoner-poisoned');
    const action   = makeAction('poisoner', [target.id]);

    const ctx    = makeCtx([poisoner, target], [token], makeActions([action]));
    const result = PoisonerResolver.resolve(ctx);

    const poisonEvent = result.resolution.events.find((e) => e.type === 'poison');
    expect(poisonEvent).toBeDefined();
    expect(poisonEvent?.description).toContain('Alice');
  });

  it('flags impaired info role with advisory', () => {
    const poisoner = makePlayer({ role: 'poisoner',      id: 'pos-id', display_name: 'Poisoner' });
    const ft       = makePlayer({ role: 'fortune-teller', id: 'ft-id',  display_name: 'FT' });
    const token    = makeToken(ft.id, 'poisoner-poisoned');
    const action   = makeAction('poisoner', [ft.id]);

    const ctx    = makeCtx([poisoner, ft], [token], makeActions([action]));
    const result = PoisonerResolver.resolve(ctx);

    const advisory = result.resolution.events.find((e) => e.type === 'advisory');
    expect(advisory).toBeDefined();
    expect(advisory?.description).toContain('Fortune Teller');
  });

  it('warns when poisoned Monk protection fails', () => {
    const poisoner = makePlayer({ role: 'poisoner', id: 'pos-id', display_name: 'Poisoner' });
    const monk     = makePlayer({ role: 'monk',     id: 'mnk-id', display_name: 'Monk' });
    const token    = makeToken(monk.id, 'poisoner-poisoned');
    const action   = makeAction('poisoner', [monk.id]);

    const ctx    = makeCtx([poisoner, monk], [token], makeActions([action]));
    const result = PoisonerResolver.resolve(ctx);

    const advisory = result.resolution.events.find(
      (e) => e.type === 'advisory' && e.description.includes('Monk'),
    );
    expect(advisory).toBeDefined();
  });

  it('does nothing if Poisoner is not in play', () => {
    const monk = makePlayer({ role: 'monk' });
    const ctx  = makeCtx([monk]);
    const result = PoisonerResolver.resolve(ctx);
    expect(result.resolution.events).toHaveLength(0);
  });
});
