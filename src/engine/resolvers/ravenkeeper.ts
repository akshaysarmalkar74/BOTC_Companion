/**
 * Ravenkeeper resolver — triggered ability stage
 *
 * The Ravenkeeper triggers ONLY if they die at night (killed by the Demon).
 * They then choose a player and learn their character.
 *
 * This resolver:
 *   - Checks whether the Ravenkeeper is in the current night's death set
 *   - If so, reads the 'ravenkeeper' night action (their chosen target)
 *   - Generates an info suggestion for the ST
 *
 * The Night Assistant already has a conditional step for Ravenkeeper; this
 * resolver confirms whether it was applicable and what info to give.
 */

import type { RoleResolver } from './types';
import type { PipelineContext } from '../types';
import { makeEventId } from '../types';
import { getPlayerByRole, getPlayerById } from '../stateEngine';
import { TROUBLE_BREWING } from '../../data/troubleBrewing';

export const RavenkeeperResolver: RoleResolver = {
  characterId: 'ravenkeeper',
  characterName: 'Ravenkeeper',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, actions, resolution } = ctx;

    const rk = getPlayerByRole(state, 'ravenkeeper');
    if (!rk) return ctx; // Not in play

    // Ravenkeeper triggers only if they die THIS night
    const rkDiesThisNight = resolution.deaths.has(rk.id);
    if (!rkDiesThisNight) return ctx;

    const rkAction = actions['ravenkeeper'];
    if (!rkAction || rkAction.target_ids.length === 0) {
      // Ravenkeeper died but no action recorded — remind ST to ask
      return {
        ...ctx,
        resolution: {
          ...resolution,
          events: [
            ...resolution.events,
            {
              id: makeEventId(),
              type: 'trigger',
              description: `Ravenkeeper (${rk.display_name}) died tonight — wake them to choose a player.`,
              affectedPlayerIds: [rk.id],
            },
          ],
          suggestions: [
            ...resolution.suggestions,
            `Ravenkeeper died tonight. Wake ${rk.display_name} to point to a player and show their role.`,
          ],
        },
      };
    }

    const targetId = rkAction.target_ids[0];
    const target   = getPlayerById(state, targetId);
    if (!target) return ctx;

    const targetChar = TROUBLE_BREWING.find((c) => c.id === target.role);

    // Note: Ravenkeeper is not affected by poison (they died before being woken)
    return {
      ...ctx,
      resolution: {
        ...resolution,
        events: [
          ...resolution.events,
          {
            id: makeEventId(),
            type: 'trigger',
            description: `Ravenkeeper (${rk.display_name}) died tonight and chose ${target.display_name} — they learn ${targetChar?.name ?? target.role}.`,
            affectedPlayerIds: [rk.id, targetId],
          },
        ],
        infoSuggestions: [
          ...resolution.infoSuggestions,
          {
            characterId: 'ravenkeeper',
            playerId: rk.id,
            abilityWorking: true,
            suggestion: `Show the Ravenkeeper the ${targetChar?.name ?? target.role} token for ${target.display_name}.`,
          },
        ],
        suggestions: [
          ...resolution.suggestions,
          `Show Ravenkeeper the ${targetChar?.name ?? target.role} token (${target.display_name}).`,
        ],
      },
    };
  },
};
