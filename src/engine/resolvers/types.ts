/**
 * Resolver layer types.
 *
 * A RoleResolver encapsulates a single character's nightly resolution logic.
 * Resolvers are called by the pipeline at the appropriate stage.
 * They are pure functions: same inputs → same outputs, no side effects.
 */

import type { PipelineContext } from '../types';

export interface RoleResolver {
  /** Must match Character.id exactly */
  characterId: string;
  /** Human-readable name for debug output */
  characterName: string;
  /** Called by the pipeline stage responsible for this role */
  resolve(ctx: PipelineContext): PipelineContext;
}
