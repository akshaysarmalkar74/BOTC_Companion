/**
 * Scarlet Woman resolver — Demon succession stage
 *
 * Triggered when the Imp dies (self-star or otherwise killed during the night).
 * Conditions for succession (official rules):
 *   - 5 or more players are alive (Travellers don't count — we have none)
 *   - The Scarlet Woman is alive
 *   - The Imp has just died (present in resolution.deaths)
 *
 * This resolver runs AFTER the Imp resolver has added the Imp to deaths.
 * On succession, the Scarlet Woman's role changes to 'imp' in roleChanges.
 */

import type { RoleResolver } from './types';
import type { PipelineContext } from '../types';
import { makeEventId } from '../types';
import {
  getAlivePlayerByRole,
  getPlayerByRole,
  aliveCount,
} from '../stateEngine';

const SUCCESSION_THRESHOLD = 5;

export const ScarletWomanResolver: RoleResolver = {
  characterId: 'scarlet-woman',
  characterName: 'Scarlet Woman',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, resolution } = ctx;

    const sw = getAlivePlayerByRole(state, 'scarlet-woman');
    if (!sw) return ctx; // Not in play or dead

    // Find the current Imp player (may already be marked as dying)
    const imp = getPlayerByRole(state, 'imp');
    if (!imp) return ctx;

    // Succession only triggers if the Imp is dying this resolution
    const impIsDying = resolution.deaths.has(imp.id);
    if (!impIsDying) return ctx;

    // Count alive players, excluding the Imp who is dying
    const currentAlive = aliveCount(state) - 1; // subtract Imp's imminent death

    if (currentAlive < SUCCESSION_THRESHOLD) {
      return {
        ...ctx,
        resolution: {
          ...resolution,
          events: [
            ...resolution.events,
            {
              id: makeEventId(),
              type: 'advisory',
              description: `Scarlet Woman succession does NOT trigger — only ${currentAlive} players alive (need ${SUCCESSION_THRESHOLD}+).`,
              affectedPlayerIds: [sw.id],
            },
          ],
          suggestions: [
            ...resolution.suggestions,
            `Scarlet Woman succession does not apply: fewer than ${SUCCESSION_THRESHOLD} players alive after the Imp's death.`,
          ],
        },
      };
    }

    // Succession applies
    const newRoleChanges = new Map(resolution.roleChanges);
    newRoleChanges.set(sw.id, 'imp');

    return {
      ...ctx,
      resolution: {
        ...resolution,
        roleChanges: newRoleChanges,
        events: [
          ...resolution.events,
          {
            id: makeEventId(),
            type: 'transform',
            description: `Scarlet Woman (${sw.display_name}) becomes the new Imp.`,
            affectedPlayerIds: [imp.id, sw.id],
          },
        ],
        suggestions: [
          ...resolution.suggestions,
          `${sw.display_name} (Scarlet Woman) becomes the Imp. Update their role token in the Grimoire.`,
        ],
      },
    };
  },
};
