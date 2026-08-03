/**
 * Information role resolvers — first-night information stage
 *
 * These characters receive one-time (or recurring) information from the
 * Storyteller. This file provides resolvers for:
 *
 *   Chef        — Number of adjacent evil pairs (Night 1)
 *   Empath      — Number of evil alive neighbours (every night)
 *   Washerwoman — Which of 2 players is a specific Townsfolk (Night 1)
 *   Librarian   — Which of 2 players is a specific Outsider (Night 1)
 *   Investigator — Which of 2 players is a specific Minion (Night 1)
 *
 * For roles where the answer is computable, the resolver calculates it.
 * For roles where the answer was recorded by the ST's action (Washerwoman etc.),
 * the resolver confirms what tokens were placed.
 *
 * All suggestions can be overridden by the Storyteller (e.g. if Recluse
 * should register as something different).
 */

import type { RoleResolver } from './types';
import type { PipelineContext } from '../types';
import { makeEventId } from '../types';
import {
  getAlivePlayerByRole,
  getPlayerById,
  isAbilityImpaired,
  countAdjacentEvilPairs,
  countEvilAliveNeighbors,
} from '../stateEngine';
import { TROUBLE_BREWING } from '../../data/troubleBrewing';

// ── Chef ──────────────────────────────────────────────────────────────────────

export const ChefResolver: RoleResolver = {
  characterId: 'chef',
  characterName: 'Chef',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state } = ctx;
    if (state.nightNumber !== 1) return ctx; // Chef only acts Night 1

    const chef = getAlivePlayerByRole(state, 'chef');
    if (!chef) return ctx;

    const impaired = isAbilityImpaired(state, chef.id);
    if (impaired) {
      return appendInfo(ctx, chef.id, 'chef', false,
        `Chef is impaired — show any number you choose.`,
        `Chef (${chef.display_name}) is poisoned/drunk — give false information.`,
      );
    }

    const pairs = countAdjacentEvilPairs(state);
    return appendInfo(ctx, chef.id, 'chef', true,
      `Show the Chef ${pairs} finger${pairs !== 1 ? 's' : ''} (${pairs} adjacent evil pair${pairs !== 1 ? 's' : ''}).`,
      `Chef (${chef.display_name}) learns: ${pairs} adjacent evil pair${pairs !== 1 ? 's' : ''}.`,
    );
  },
};

// ── Empath ────────────────────────────────────────────────────────────────────

export const EmpathResolver: RoleResolver = {
  characterId: 'empath',
  characterName: 'Empath',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state } = ctx;

    const empath = getAlivePlayerByRole(state, 'empath');
    if (!empath) return ctx;

    const impaired = isAbilityImpaired(state, empath.id);
    if (impaired) {
      return appendInfo(ctx, empath.id, 'empath', false,
        `Empath is impaired — show any number (0, 1, or 2).`,
        `Empath (${empath.display_name}) is poisoned/drunk — give false information.`,
      );
    }

    const count = countEvilAliveNeighbors(state, empath.id);
    return appendInfo(ctx, empath.id, 'empath', true,
      `Show the Empath ${count} finger${count !== 1 ? 's' : ''} (${count} evil alive neighbour${count !== 1 ? 's' : ''}).`,
      `Empath (${empath.display_name}) learns: ${count} evil alive neighbour${count !== 1 ? 's' : ''}.`,
    );
  },
};

// ── Washerwoman ───────────────────────────────────────────────────────────────

export const WasherwomanResolver: RoleResolver = {
  characterId: 'washerwoman',
  characterName: 'Washerwoman',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, actions } = ctx;
    if (state.nightNumber !== 1) return ctx;

    const ww = getAlivePlayerByRole(state, 'washerwoman');
    if (!ww) return ctx;

    const action = actions['washerwoman'];
    if (!action || action.target_ids.length < 2) return ctx;

    const [trueId, wrongId] = action.target_ids;
    const truePlayer  = getPlayerById(state, trueId);
    const wrongPlayer = getPlayerById(state, wrongId);
    if (!truePlayer || !wrongPlayer) return ctx;

    const trueChar  = TROUBLE_BREWING.find((c) => c.id === truePlayer.role);
    const impaired  = isAbilityImpaired(state, ww.id);

    if (impaired) {
      return appendInfo(ctx, ww.id, 'washerwoman', false,
        `Washerwoman is impaired — show any Townsfolk token with any two players.`,
        `Washerwoman (${ww.display_name}) is poisoned/drunk — give false information.`,
      );
    }

    return appendInfo(ctx, ww.id, 'washerwoman', true,
      `Show Washerwoman: ${truePlayer.display_name} & ${wrongPlayer.display_name} are the two players. ${trueChar?.name ?? '?'} token shown (${truePlayer.display_name} is the Townsfolk).`,
      `Washerwoman (${ww.display_name}) sees ${truePlayer.display_name} & ${wrongPlayer.display_name} — one is the ${trueChar?.name ?? '?'}.`,
    );
  },
};

// ── Librarian ─────────────────────────────────────────────────────────────────

export const LibrarianResolver: RoleResolver = {
  characterId: 'librarian',
  characterName: 'Librarian',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, actions } = ctx;
    if (state.nightNumber !== 1) return ctx;

    const lib = getAlivePlayerByRole(state, 'librarian');
    if (!lib) return ctx;

    const action = actions['librarian'];
    if (!action || action.target_ids.length < 2) return ctx;

    const [outsiderId, wrongId] = action.target_ids;
    const outsiderPlayer = getPlayerById(state, outsiderId);
    const wrongPlayer    = getPlayerById(state, wrongId);
    if (!outsiderPlayer || !wrongPlayer) return ctx;

    const outsiderChar = TROUBLE_BREWING.find((c) => c.id === outsiderPlayer.role);
    const impaired     = isAbilityImpaired(state, lib.id);

    if (impaired) {
      return appendInfo(ctx, lib.id, 'librarian', false,
        `Librarian is impaired — show any Outsider token (or 0) with any two players.`,
        `Librarian (${lib.display_name}) is poisoned/drunk — give false information.`,
      );
    }

    return appendInfo(ctx, lib.id, 'librarian', true,
      `Show Librarian: ${outsiderPlayer.display_name} & ${wrongPlayer.display_name}. ${outsiderChar?.name ?? '?'} token shown (${outsiderPlayer.display_name} is the Outsider).`,
      `Librarian (${lib.display_name}) sees ${outsiderPlayer.display_name} & ${wrongPlayer.display_name} — one is the ${outsiderChar?.name ?? '?'}.`,
    );
  },
};

// ── Investigator ──────────────────────────────────────────────────────────────

export const InvestigatorResolver: RoleResolver = {
  characterId: 'investigator',
  characterName: 'Investigator',

  resolve(ctx: PipelineContext): PipelineContext {
    const { state, actions } = ctx;
    if (state.nightNumber !== 1) return ctx;

    const inv = getAlivePlayerByRole(state, 'investigator');
    if (!inv) return ctx;

    const action = actions['investigator'];
    if (!action || action.target_ids.length < 2) return ctx;

    const [minionId, wrongId] = action.target_ids;
    const minionPlayer = getPlayerById(state, minionId);
    const wrongPlayer  = getPlayerById(state, wrongId);
    if (!minionPlayer || !wrongPlayer) return ctx;

    const minionChar = TROUBLE_BREWING.find((c) => c.id === minionPlayer.role);
    const impaired   = isAbilityImpaired(state, inv.id);

    if (impaired) {
      return appendInfo(ctx, inv.id, 'investigator', false,
        `Investigator is impaired — show any Minion token with any two players.`,
        `Investigator (${inv.display_name}) is poisoned/drunk — give false information.`,
      );
    }

    return appendInfo(ctx, inv.id, 'investigator', true,
      `Show Investigator: ${minionPlayer.display_name} & ${wrongPlayer.display_name}. ${minionChar?.name ?? '?'} token shown (${minionPlayer.display_name} is the Minion).`,
      `Investigator (${inv.display_name}) sees ${minionPlayer.display_name} & ${wrongPlayer.display_name} — one is the ${minionChar?.name ?? '?'}.`,
    );
  },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function appendInfo(
  ctx: PipelineContext,
  playerId: string,
  characterId: string,
  abilityWorking: boolean,
  suggestion: string,
  eventDescription: string,
): PipelineContext {
  return {
    ...ctx,
    resolution: {
      ...ctx.resolution,
      events: [
        ...ctx.resolution.events,
        {
          id: makeEventId(),
          type: 'info',
          description: eventDescription,
          affectedPlayerIds: [playerId],
        },
      ],
      infoSuggestions: [
        ...ctx.resolution.infoSuggestions,
        { characterId, playerId, abilityWorking, suggestion },
      ],
      suggestions: [...ctx.resolution.suggestions, suggestion],
    },
  };
}
