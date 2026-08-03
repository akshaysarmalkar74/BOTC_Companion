/**
 * Poisoner resolver — poison advisory stage
 *
 * The Poisoner's nightly action is already persisted by the Night Assistant
 * (step key: 'poisoner'), and the 'poisoner-poisoned' reminder token is
 * auto-placed on the target at that time.
 *
 * This resolver generates an event confirming who is poisoned, and flags any
 * info roles whose ability will malfunction as a result.
 */

import type { RoleResolver } from './types';
import type { PipelineContext } from '../types';
import { makeEventId } from '../types';
import { getAlivePlayerByRole, getPlayerById, isPoisoned } from '../stateEngine';
import { TROUBLE_BREWING } from '../../data/troubleBrewing';

/** Roles that give information — poison makes their output unreliable */
const INFO_ROLE_IDS = new Set([
  'washerwoman', 'librarian', 'investigator', 'chef', 'empath',
  'fortune-teller', 'undertaker', 'ravenkeeper',
]);

export const PoisonerResolver: RoleResolver = {
  characterId: 'poisoner',
  characterName: 'Poisoner',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, actions } = ctx;
    let result = ctx;

    const poisoner = getAlivePlayerByRole(state, 'poisoner');
    if (!poisoner) return ctx;

    const poisonerAction = actions['poisoner'];
    if (!poisonerAction || poisonerAction.target_ids.length === 0) return ctx;

    const targetId = poisonerAction.target_ids[0];
    const target   = getPlayerById(state, targetId);
    if (!target) return ctx;

    // Confirm who is poisoned
    result = appendEvent(result, {
      type: 'poison',
      description: `Poisoner (${poisoner.display_name}) poisoned ${target.display_name} tonight.`,
      affectedPlayerIds: [poisoner.id, targetId],
    });

    // Flag any impaired roles
    const targetChar = TROUBLE_BREWING.find((c) => c.id === target.role);
    if (targetChar && INFO_ROLE_IDS.has(targetChar.id)) {
      result = appendEvent(result, {
        type: 'advisory',
        description: `${target.display_name} (${targetChar.name}) is poisoned — their information is unreliable tonight.`,
        affectedPlayerIds: [targetId],
        suggestion: `Give ${target.display_name} false information as the ${targetChar.name} tonight (they are poisoned).`,
      });
    }

    // Also warn if the Monk is poisoned (protection will fail)
    const monk = getAlivePlayerByRole(state, 'monk');
    if (monk && isPoisoned(state, monk.id)) {
      result = appendEvent(result, {
        type: 'advisory',
        description: `Monk (${monk.display_name}) is poisoned — any protection they placed tonight is ineffective.`,
        affectedPlayerIds: [monk.id],
        suggestion: `The Monk is poisoned. Their protection token should be ignored.`,
      });
    }

    return result;
  },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function appendEvent(
  ctx: PipelineContext,
  opts: {
    type: import('../types').EventType;
    description: string;
    affectedPlayerIds: string[];
    suggestion?: string;
  },
): PipelineContext {
  return {
    ...ctx,
    resolution: {
      ...ctx.resolution,
      events: [
        ...ctx.resolution.events,
        {
          id: makeEventId(),
          type: opts.type,
          description: opts.description,
          affectedPlayerIds: opts.affectedPlayerIds,
        },
      ],
      suggestions: opts.suggestion
        ? [...ctx.resolution.suggestions, opts.suggestion]
        : ctx.resolution.suggestions,
    },
  };
}
