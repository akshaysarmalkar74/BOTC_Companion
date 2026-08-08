/**
 * Undertaker resolver — information stage
 *
 * The Undertaker wakes each night after an execution and learns the
 * executed player's character. This resolver uses state.executedPlayerId
 * (set by the caller from DayEvents) to generate the suggestion.
 *
 * If the Undertaker is poisoned, they receive false information (ST decides).
 * No execution → no wake, no information.
 */

import type { RoleResolver } from './types';
import type { PipelineContext } from '../types';
import { makeEventId } from '../types';
import { getAlivePlayerByRole, getPlayerById, isAbilityImpaired } from '../stateEngine';
import { TROUBLE_BREWING } from '../../data/troubleBrewing';

export const UndertakerResolver: RoleResolver = {
  characterId: 'undertaker',
  characterName: 'Undertaker',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, resolution } = ctx;

    // Night 1 — Undertaker doesn't act on the first night (marked with *)
    if (state.nightNumber === 1) return ctx;

    const ut = getAlivePlayerByRole(state, 'undertaker');
    if (!ut) return ctx;

    if (!state.executedPlayerId) {
      // No execution yesterday — Undertaker stays asleep
      return {
        ...ctx,
        resolution: {
          ...resolution,
          suggestions: [
            ...resolution.suggestions,
            `No execution yesterday — do not wake the Undertaker.`,
          ],
        },
      };
    }

    const executed = getPlayerById(state, state.executedPlayerId);
    if (!executed) return ctx;

    // Prefer the snapshotted role (captured at execution time) to avoid stale
    // reads if the player's role was updated afterwards (e.g. SW succession).
    const executedRoleId = state.executedPlayerRole ?? executed.role;
    const executedChar = TROUBLE_BREWING.find((c) => c.id === executedRoleId);
    const impaired = isAbilityImpaired(state, ut.id);

    if (impaired) {
      return {
        ...ctx,
        resolution: {
          ...resolution,
          events: [
            ...resolution.events,
            {
              id: makeEventId(),
              type: 'info',
              description: `Undertaker (${ut.display_name}) is impaired — show them any role token.`,
              affectedPlayerIds: [ut.id, executed.id],
            },
          ],
          infoSuggestions: [
            ...resolution.infoSuggestions,
            {
              characterId: 'undertaker',
              playerId: ut.id,
              abilityWorking: false,
              suggestion: `Show the Undertaker any role token — their ability is impaired.`,
            },
          ],
          suggestions: [
            ...resolution.suggestions,
            `Undertaker is poisoned/drunk. Show them any false role for the executed player.`,
          ],
        },
      };
    }

    return {
      ...ctx,
      resolution: {
        ...resolution,
        events: [
          ...resolution.events,
          {
            id: makeEventId(),
            type: 'info',
            description: `Undertaker (${ut.display_name}) learns ${executed.display_name} was the ${executedChar?.name ?? executedRoleId}.`,
            affectedPlayerIds: [ut.id, executed.id],
          },
        ],
        infoSuggestions: [
          ...resolution.infoSuggestions,
          {
            characterId: 'undertaker',
            playerId: ut.id,
            abilityWorking: true,
            suggestion: `Show the Undertaker the ${executedChar?.name ?? executedRoleId} token (${executed.display_name} was executed yesterday).`,
          },
        ],
        suggestions: [
          ...resolution.suggestions,
          `Show Undertaker the ${executedChar?.name ?? executedRoleId} token for ${executed.display_name}.`,
        ],
      },
    };
  },
};
