/**
 * Passive / day-phase resolver advisories
 *
 * These characters have no automatable night resolution — their abilities are
 * either setup-only, day-phase, or involve Storyteller discretion. This file
 * generates informational advisory events to prompt the Storyteller at the
 * right moments.
 *
 * Characters handled here:
 *
 *   Butler     — Chose a master last night; that choice is already token-tracked.
 *                Advisory reminds ST of the day-voting restriction.
 *   Drunk      — Receives false info as a Townsfolk. Advisory flagged by
 *                poisoner.ts when an info role is impaired.
 *   Recluse    — May register as evil. Advisory reminds ST of discretion.
 *   Spy        — Saw Grimoire (handled by night assistant step). Advisory
 *                confirms they may register as good.
 *   Virgin     — One-time day-phase ability. No night resolution.
 *   Slayer     — Day-phase, once-per-game ability. No night resolution.
 *   Saint      — Day-phase loss condition. No night resolution.
 *   Baron      — Setup only (+2 Outsiders). No nightly ability.
 *   Soldier    — Passive immunity (handled in imp.ts). Advisory here optional.
 *   Mayor      — Win condition + redirect. Advisory generated in imp.ts.
 */

import type { RoleResolver } from './types';
import type { PipelineContext } from '../types';
import { makeEventId } from '../types';
import { getAlivePlayerByRole, getPlayerById } from '../stateEngine';

// ── Butler ────────────────────────────────────────────────────────────────────

export const ButlerResolver: RoleResolver = {
  characterId: 'butler',
  characterName: 'Butler',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, resolution } = ctx;

    const butler = getAlivePlayerByRole(state, 'butler');
    if (!butler) return ctx;

    const masterToken = state.reminderTokens.find(
      (t) => t.token_key === 'butler-master',
    );
    if (!masterToken) return ctx;

    const master = getPlayerById(state, masterToken.player_id);
    if (!master) return ctx;

    return {
      ...ctx,
      resolution: {
        ...resolution,
        events: [
          ...resolution.events,
          {
            id: makeEventId(),
            type: 'advisory',
            description: `Butler (${butler.display_name}) may only vote today if their master ${master.display_name} votes first.`,
            affectedPlayerIds: [butler.id, master.id],
          },
        ],
        suggestions: [
          ...resolution.suggestions,
          `Butler (${butler.display_name}) chose ${master.display_name} as master — enforce voting restriction today.`,
        ],
      },
    };
  },
};

// ── Recluse ───────────────────────────────────────────────────────────────────

export const RecluseResolver: RoleResolver = {
  characterId: 'recluse',
  characterName: 'Recluse',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, resolution } = ctx;

    const recluse = getAlivePlayerByRole(state, 'recluse');
    if (!recluse) return ctx;

    return {
      ...ctx,
      resolution: {
        ...resolution,
        events: [
          ...resolution.events,
          {
            id: makeEventId(),
            type: 'advisory',
            description: `Recluse (${recluse.display_name}) may register as evil or as a Minion/Demon to detection abilities at your discretion.`,
            affectedPlayerIds: [recluse.id],
          },
        ],
        suggestions: [
          ...resolution.suggestions,
          `Remember: the Recluse may misregister as evil. Adjust information roles' answers if you choose.`,
        ],
      },
    };
  },
};

// ── Spy ───────────────────────────────────────────────────────────────────────

export const SpyResolver: RoleResolver = {
  characterId: 'spy',
  characterName: 'Spy',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, resolution } = ctx;

    const spy = getAlivePlayerByRole(state, 'spy');
    if (!spy) return ctx;

    return {
      ...ctx,
      resolution: {
        ...resolution,
        events: [
          ...resolution.events,
          {
            id: makeEventId(),
            type: 'advisory',
            description: `Spy (${spy.display_name}) saw the Grimoire tonight. They may also register as good to detection abilities.`,
            affectedPlayerIds: [spy.id],
          },
        ],
        suggestions: [
          ...resolution.suggestions,
          `Spy saw the Grimoire. Remember they may register as Townsfolk/Outsider to info roles.`,
        ],
      },
    };
  },
};
