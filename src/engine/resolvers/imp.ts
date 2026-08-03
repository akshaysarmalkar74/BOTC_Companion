/**
 * Imp resolver — death stage
 *
 * The Imp chooses one player to kill each night (after the first).
 * Three interactions are resolved here:
 *
 *  1. Monk protection: if the target is protected, the kill is blocked.
 *  2. Soldier immunity: if the target is the Soldier (not poisoned), kill is blocked.
 *  3. Mayor redirect: if the target is the Mayor (ability not impaired), the
 *     Storyteller may redirect the death. An advisory is generated.
 *  4. Self-star: if the Imp kills themselves, they die and the Scarlet Woman
 *     succession resolver takes over (handled in scarletWoman.ts).
 */

import type { RoleResolver } from './types';
import type { PipelineContext } from '../types';
import { makeEventId } from '../types';
import {
  getAlivePlayerByRole,
  getPlayerById,
  isMonkProtected,
  isSoldier,
  isMayor,
  isAbilityImpaired,
} from '../stateEngine';

export const ImpResolver: RoleResolver = {
  characterId: 'imp',
  characterName: 'Imp',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, actions, resolution } = ctx;

    const imp = getAlivePlayerByRole(state, 'imp');
    if (!imp) return ctx; // Imp not in play or already dead

    const impAction = actions['imp'];
    if (!impAction || impAction.target_ids.length === 0) return ctx;

    const targetId = impAction.target_ids[0];
    const target   = getPlayerById(state, targetId);
    if (!target) return ctx;

    // ── Self-star ─────────────────────────────────────────────────────────
    if (targetId === imp.id) {
      // Imp dies; Scarlet Woman succession is handled by its own resolver
      return {
        ...ctx,
        resolution: {
          ...resolution,
          deaths: new Set([...resolution.deaths, imp.id]),
          events: [
            ...resolution.events,
            {
              id: makeEventId(),
              type: 'death',
              description: `Imp (${imp.display_name}) chose to kill themselves (self-star).`,
              affectedPlayerIds: [imp.id],
            },
          ],
          suggestions: [
            ...resolution.suggestions,
            `${imp.display_name} (Imp) killed themselves. Check if Scarlet Woman succession applies.`,
          ],
        },
      };
    }

    // ── Soldier immunity ──────────────────────────────────────────────────
    if (isSoldier(state, targetId)) {
      return {
        ...ctx,
        resolution: {
          ...resolution,
          events: [
            ...resolution.events,
            {
              id: makeEventId(),
              type: 'protection',
              description: `Imp attacked ${target.display_name} (Soldier) — Soldier is immune to Demon attacks.`,
              affectedPlayerIds: [imp.id, targetId],
            },
          ],
          suggestions: [
            ...resolution.suggestions,
            `${target.display_name} is the Soldier. The Imp's attack fails — nobody dies from this kill.`,
          ],
        },
      };
    }

    // ── Monk protection ───────────────────────────────────────────────────
    if (isMonkProtected(state, targetId)) {
      return {
        ...ctx,
        resolution: {
          ...resolution,
          events: [
            ...resolution.events,
            {
              id: makeEventId(),
              type: 'protection',
              description: `Imp attacked ${target.display_name} — Monk protection prevented the kill.`,
              affectedPlayerIds: [imp.id, targetId],
            },
          ],
          suggestions: [
            ...resolution.suggestions,
            `${target.display_name} was protected by the Monk. Nobody dies tonight from the Demon kill.`,
          ],
        },
      };
    }

    // ── Mayor redirect (advisory) ─────────────────────────────────────────
    if (isMayor(state, targetId)) {
      // The kill CAN be redirected — but it's the Storyteller's choice.
      // We suggest the death of the Mayor as default; the ST can override.
      const events = [
        ...resolution.events,
        {
          id: makeEventId(),
          type: 'death' as const,
          description: `Imp attacked ${target.display_name} (Mayor).`,
          affectedPlayerIds: [imp.id, targetId],
        },
        {
          id: makeEventId(),
          type: 'advisory' as const,
          description: `Mayor ability: the Storyteller may redirect this kill to another player instead.`,
          affectedPlayerIds: [targetId],
        },
      ];
      return {
        ...ctx,
        resolution: {
          ...resolution,
          deaths: new Set([...resolution.deaths, targetId]),
          events,
          suggestions: [
            ...resolution.suggestions,
            `${target.display_name} is the Mayor. You may redirect the Demon kill to another player — override the death if you do.`,
          ],
        },
      };
    }

    // ── Standard kill ─────────────────────────────────────────────────────
    // Check if Imp itself is poisoned (poisoned Imp still kills normally —
    // the Imp's ability is the kill, not an information ability)
    const impPoisoned = isAbilityImpaired(state, imp.id);

    if (impPoisoned) {
      // Poisoned Imp: Storyteller decides whether the kill works.
      // Convention: poisoned Imp's kill fails (Storyteller controls).
      return {
        ...ctx,
        resolution: {
          ...resolution,
          events: [
            ...resolution.events,
            {
              id: makeEventId(),
              type: 'advisory',
              description: `Imp (${imp.display_name}) is poisoned — their kill may not work. Storyteller decides.`,
              affectedPlayerIds: [imp.id, targetId],
            },
          ],
          suggestions: [
            ...resolution.suggestions,
            `The Imp is poisoned. You decide whether ${target.display_name} dies tonight.`,
          ],
        },
      };
    }

    return {
      ...ctx,
      resolution: {
        ...resolution,
        deaths: new Set([...resolution.deaths, targetId]),
        events: [
          ...resolution.events,
          {
            id: makeEventId(),
            type: 'death',
            description: `Imp (${imp.display_name}) killed ${target.display_name} tonight.`,
            affectedPlayerIds: [imp.id, targetId],
          },
        ],
        suggestions: [
          ...resolution.suggestions,
          `${target.display_name} dies tonight (killed by the Imp).`,
        ],
      },
    };
  },
};
