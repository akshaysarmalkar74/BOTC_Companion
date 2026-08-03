/**
 * Resolution Pipeline
 *
 * The 10-stage pipeline that takes a GameState + recorded NightActions and
 * produces a NightResolution (suggested deaths, role changes, info, events).
 *
 * Each stage is a pure function: PipelineContext → PipelineContext.
 * Stages are composed in order; earlier stages inform later ones.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Stage 1  │ Validate          │ Detect impossible states        │
 * │  Stage 2  │ Poison            │ Flag impaired players           │
 * │  Stage 3  │ Protection        │ Monk — note who is protected    │
 * │  Stage 4  │ Information       │ Chef, Empath, FT, WW etc.      │
 * │  Stage 5  │ Deaths            │ Imp kill, Soldier, Mayor        │
 * │  Stage 6  │ Transforms        │ Scarlet Woman succession        │
 * │  Stage 7  │ Triggered         │ Ravenkeeper, etc.               │
 * │  Stage 8  │ Passive/Advisory  │ Butler, Spy, Recluse            │
 * │  Stage 9  │ Summary           │ Produce final suggestion list   │
 * │ Stage 10  │ (reserved)        │ Future: persistent-effect hooks │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Adding a new script: register resolvers in resolvers/index.ts.
 * The pipeline calls resolvers by ID; any unrecognized IDs are skipped.
 */

import type { GameState, NightActionMap, NightResolution, PipelineContext } from './types';
import { emptyResolution, makeEventId } from './types';
import { stageValidate } from './validation';
import { RESOLVER_BY_ID } from './resolvers/index';

// ── Stage implementations ──────────────────────────────────────────────────

function runResolver(ctx: PipelineContext, characterId: string): PipelineContext {
  const resolver = RESOLVER_BY_ID.get(characterId);
  if (!resolver) return ctx;
  try {
    return resolver.resolve(ctx);
  } catch (err) {
    // Never crash the pipeline — surface as a warning
    return {
      ...ctx,
      resolution: {
        ...ctx.resolution,
        warnings: [
          ...ctx.resolution.warnings,
          {
            type: 'resolver-error',
            message: `Error in resolver for "${characterId}": ${String(err)}`,
            severity: 'error',
          },
        ],
      },
    };
  }
}

/** Stage 2: poison advisory */
function stagePoisonAdvisory(ctx: PipelineContext): PipelineContext {
  return runResolver(ctx, 'poisoner');
}

/** Stage 3: protection */
function stageProtection(ctx: PipelineContext): PipelineContext {
  return runResolver(ctx, 'monk');
}

/** Stage 4: information roles */
function stageInformation(ctx: PipelineContext): PipelineContext {
  let result = ctx;
  for (const id of [
    'washerwoman', 'librarian', 'investigator',
    'chef', 'empath', 'fortune-teller', 'undertaker',
  ]) {
    result = runResolver(result, id);
  }
  return result;
}

/** Stage 5: Demon kills and kill-prevention */
function stageDeaths(ctx: PipelineContext): PipelineContext {
  return runResolver(ctx, 'imp');
}

/** Stage 6: role transforms (Scarlet Woman succession) */
function stageTransforms(ctx: PipelineContext): PipelineContext {
  return runResolver(ctx, 'scarlet-woman');
}

/** Stage 7: abilities triggered by earlier results (Ravenkeeper) */
function stageTriggered(ctx: PipelineContext): PipelineContext {
  return runResolver(ctx, 'ravenkeeper');
}

/** Stage 8: passive and advisory roles */
function stageAdvisory(ctx: PipelineContext): PipelineContext {
  let result = ctx;
  for (const id of ['butler', 'recluse', 'spy']) {
    result = runResolver(result, id);
  }
  return result;
}

/** Stage 9: produce a final human-readable night summary event */
function stageSummary(ctx: PipelineContext): PipelineContext {
  const { state, resolution } = ctx;
  const deaths  = [...resolution.deaths];
  const changes = [...resolution.roleChanges.entries()];

  const lines: string[] = [];

  if (deaths.length === 0) {
    lines.push('Nobody died tonight.');
  } else {
    const names = deaths.map((id) => {
      const p = state.players.find((pl) => pl.id === id);
      return p?.display_name ?? id;
    });
    lines.push(`Died tonight: ${names.join(', ')}.`);
  }

  if (changes.length > 0) {
    for (const [playerId, newRole] of changes) {
      const p = state.players.find((pl) => pl.id === playerId);
      lines.push(`${p?.display_name ?? playerId} becomes the ${newRole}.`);
    }
  }

  const summaryEvent = {
    id: makeEventId(),
    type: 'advisory' as const,
    description: `Night ${state.nightNumber} summary: ${lines.join(' ')}`,
    affectedPlayerIds: [...deaths, ...changes.map(([id]) => id)],
  };

  return {
    ...ctx,
    resolution: {
      ...resolution,
      events: [...resolution.events, summaryEvent],
    },
  };
}

// ── Main entry point ────────────────────────────────────────────────────────

/**
 * Run the full 10-stage resolution pipeline.
 *
 * @param state     - Current game state snapshot (immutable)
 * @param actions   - All night actions recorded for this night
 * @returns         - Suggested NightResolution (all fields overridable by ST)
 */
export function resolveNight(
  state: GameState,
  actions: NightActionMap,
): NightResolution {
  const initial: PipelineContext = {
    state,
    actions,
    resolution: emptyResolution(),
  };

  const stages = [
    stageValidate,       // 1
    stagePoisonAdvisory, // 2
    stageProtection,     // 3
    stageInformation,    // 4
    stageDeaths,         // 5
    stageTransforms,     // 6
    stageTriggered,      // 7
    stageAdvisory,       // 8
    stageSummary,        // 9
    // Stage 10 is reserved for future persistent-effect hooks
  ];

  const final = stages.reduce((ctx, stage) => stage(ctx), initial);
  return final.resolution;
}

// ── Utility: build NightActionMap from an array ─────────────────────────────

export function buildActionMap(actions: import('../types').NightAction[]): NightActionMap {
  const map: NightActionMap = {};
  for (const a of actions) {
    map[a.step_key] = a;
  }
  return map;
}
