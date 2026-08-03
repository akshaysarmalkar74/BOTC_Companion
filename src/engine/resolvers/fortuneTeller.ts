/**
 * Fortune Teller resolver — information stage
 *
 * The Fortune Teller picks 2 players each night (step key: 'fortune-teller').
 * The Storyteller answers YES if either player is the Demon OR the Red Herring.
 * If the FT is poisoned or drunk, the Storyteller gives any answer.
 *
 * This resolver suggests what answer to give; the Storyteller can always override.
 *
 * Red Herring: one good player has the 'fortune-teller-red-herring' token
 * (placed on Night 1 at setup — typically placed manually by the Storyteller).
 */

import type { RoleResolver } from './types';
import type { PipelineContext } from '../types';
import { makeEventId } from '../types';
import {
  getAlivePlayerByRole,
  getPlayerById,
  isDemon,
  getRedHerringPlayerId,
  isAbilityImpaired,
} from '../stateEngine';

export const FortuneTellerResolver: RoleResolver = {
  characterId: 'fortune-teller',
  characterName: 'Fortune Teller',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, actions, resolution } = ctx;

    const ft = getAlivePlayerByRole(state, 'fortune-teller');
    if (!ft) return ctx;

    const ftAction = actions['fortune-teller'];
    if (!ftAction || ftAction.target_ids.length < 2) return ctx;

    const [id1, id2] = ftAction.target_ids;
    const p1 = getPlayerById(state, id1);
    const p2 = getPlayerById(state, id2);
    if (!p1 || !p2) return ctx;

    const impaired = isAbilityImpaired(state, ft.id);

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
              description: `Fortune Teller (${ft.display_name}) asked about ${p1.display_name} & ${p2.display_name} — but their ability is impaired.`,
              affectedPlayerIds: [ft.id, id1, id2],
            },
          ],
          infoSuggestions: [
            ...resolution.infoSuggestions,
            {
              characterId: 'fortune-teller',
              playerId: ft.id,
              abilityWorking: false,
              suggestion: `You may give any answer (YES or NO) — the Fortune Teller is poisoned/drunk.`,
            },
          ],
          suggestions: [
            ...resolution.suggestions,
            `Fortune Teller is impaired. Give any answer you choose.`,
          ],
        },
      };
    }

    const redHerringId = getRedHerringPlayerId(state);
    const target1IsDemon      = isDemon(state, id1);
    const target2IsDemon      = isDemon(state, id2);
    const target1IsRedHerring = id1 === redHerringId;
    const target2IsRedHerring = id2 === redHerringId;

    const shouldAnswerYes =
      target1IsDemon || target2IsDemon ||
      target1IsRedHerring || target2IsRedHerring;

    const reason = (() => {
      if (target1IsDemon)      return `${p1.display_name} is the Demon`;
      if (target2IsDemon)      return `${p2.display_name} is the Demon`;
      if (target1IsRedHerring) return `${p1.display_name} is the Red Herring`;
      if (target2IsRedHerring) return `${p2.display_name} is the Red Herring`;
      return 'neither player is the Demon or Red Herring';
    })();

    const answer = shouldAnswerYes ? 'YES' : 'NO';

    return {
      ...ctx,
      resolution: {
        ...resolution,
        events: [
          ...resolution.events,
          {
            id: makeEventId(),
            type: 'info',
            description: `Fortune Teller (${ft.display_name}) asked about ${p1.display_name} & ${p2.display_name} — answer should be ${answer} (${reason}).`,
            affectedPlayerIds: [ft.id, id1, id2],
          },
        ],
        infoSuggestions: [
          ...resolution.infoSuggestions,
          {
            characterId: 'fortune-teller',
            playerId: ft.id,
            abilityWorking: true,
            suggestion: `Answer ${answer} — ${reason}.`,
          },
        ],
        suggestions: [
          ...resolution.suggestions,
          `Tell Fortune Teller "${answer}" (${reason}).`,
        ],
      },
    };
  },
};
