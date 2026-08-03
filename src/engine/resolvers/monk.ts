/**
 * Monk resolver — protection stage
 *
 * The Monk's action is recorded by the Night Assistant (step key: 'monk').
 * The Night Assistant also auto-places the 'monk-protected' reminder token.
 *
 * This resolver generates an advisory event describing the protection state.
 * The actual kill-blocking logic lives in the Imp resolver (death stage), which
 * calls isMonkProtected() from the state engine.
 */

import type { RoleResolver } from './types';
import type { PipelineContext } from '../types';
import { makeEventId } from '../types';
import { getAlivePlayerByRole, isAbilityImpaired, getPlayerById } from '../stateEngine';

export const MonkResolver: RoleResolver = {
  characterId: 'monk',
  characterName: 'Monk',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, actions } = ctx;

    const monk = getAlivePlayerByRole(state, 'monk');
    if (!monk) return ctx; // Monk not in play or dead

    const monkAction = actions['monk'];
    if (!monkAction || monkAction.target_ids.length === 0) return ctx; // No action recorded

    const targetId  = monkAction.target_ids[0];
    const target    = getPlayerById(state, targetId);
    if (!target) return ctx;

    const monkIsPoisoned = isAbilityImpaired(state, monk.id);

    if (monkIsPoisoned) {
      return addEvent(ctx, {
        type: 'advisory',
        description: `Monk (${monk.display_name}) is poisoned — ${target.display_name} is NOT protected tonight.`,
        affectedPlayerIds: [monk.id, targetId],
        suggestion: `The Monk is poisoned. ${target.display_name}'s protection fails tonight.`,
      });
    }

    return addEvent(ctx, {
      type: 'protection',
      description: `Monk (${monk.display_name}) protected ${target.display_name} tonight.`,
      affectedPlayerIds: [monk.id, targetId],
      suggestion: `${target.display_name} is protected by the Monk. Demon kills targeting them will fail.`,
    });
  },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function addEvent(
  ctx: PipelineContext,
  opts: {
    type: import('../types').EventType;
    description: string;
    affectedPlayerIds: string[];
    suggestion?: string;
  },
): PipelineContext {
  const { resolution } = ctx;
  return {
    ...ctx,
    resolution: {
      ...resolution,
      events: [
        ...resolution.events,
        { id: makeEventId(), type: opts.type, description: opts.description, affectedPlayerIds: opts.affectedPlayerIds },
      ],
      suggestions: opts.suggestion
        ? [...resolution.suggestions, opts.suggestion]
        : resolution.suggestions,
    },
  };
}
