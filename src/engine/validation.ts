/**
 * Validation — detects impossible or illegal game states before resolution.
 *
 * Validation runs as the first pipeline stage. Errors are non-fatal:
 * the pipeline continues and returns warnings alongside the resolution.
 * The Storyteller sees the warnings and can decide how to proceed.
 */

import type { PipelineContext, ValidationWarning } from './types';
import { TROUBLE_BREWING } from '../data/troubleBrewing';

export function stageValidate(ctx: PipelineContext): PipelineContext {
  const { state, actions, resolution } = ctx;
  const warnings: ValidationWarning[] = [...resolution.warnings];

  // ── Duplicate roles ────────────────────────────────────────────────────────
  const roleCounts = new Map<string, number>();
  for (const player of state.players) {
    if (!player.role) continue;
    roleCounts.set(player.role, (roleCounts.get(player.role) ?? 0) + 1);
  }
  for (const [role, count] of roleCounts) {
    if (count > 1) {
      const char = TROUBLE_BREWING.find((c) => c.id === role);
      warnings.push({
        type: 'duplicate-role',
        message: `${char?.name ?? role} is assigned to ${count} players. Each role should appear at most once.`,
        severity: 'error',
      });
    }
  }

  // ── Multiple Demons ────────────────────────────────────────────────────────
  const demonRoles = ['imp'];
  const demonPlayers = state.players.filter(
    (p) => p.is_alive && demonRoles.includes(p.role ?? ''),
  );
  if (demonPlayers.length > 1) {
    warnings.push({
      type: 'multiple-demons',
      message: `${demonPlayers.length} players are assigned Demon roles. There should only be one Demon.`,
      severity: 'error',
    });
  }

  // ── Unassigned players ─────────────────────────────────────────────────────
  const unassigned = state.players.filter((p) => !p.role);
  if (unassigned.length > 0) {
    warnings.push({
      type: 'unassigned-players',
      message: `${unassigned.length} player${unassigned.length > 1 ? 's have' : ' has'} no role assigned: ${unassigned.map((p) => p.display_name).join(', ')}.`,
      severity: 'warning',
    });
  }

  // ── Illegal action targets ─────────────────────────────────────────────────
  for (const [stepKey, action] of Object.entries(actions)) {
    for (const targetId of action.target_ids) {
      const targetExists = state.players.some((p) => p.id === targetId);
      if (!targetExists) {
        warnings.push({
          type: 'invalid-target',
          message: `Night action "${stepKey}" references unknown player ID "${targetId}".`,
          severity: 'error',
        });
      }
    }
  }

  // ── Monk targeting themselves ──────────────────────────────────────────────
  const monkAction = actions['monk'];
  if (monkAction?.target_ids.length > 0) {
    const monk = state.players.find((p) => p.role === 'monk');
    if (monk && monkAction.target_ids[0] === monk.id) {
      warnings.push({
        type: 'monk-self-target',
        message: `Monk cannot protect themselves. Their action targets themselves, which is illegal.`,
        severity: 'error',
      });
    }
  }

  // ── Imp action on Night 1 ──────────────────────────────────────────────────
  if (state.nightNumber === 1 && actions['imp']) {
    warnings.push({
      type: 'imp-night1',
      message: `The Imp does not kill on Night 1 (marked with *). An action was recorded for the Imp on Night 1.`,
      severity: 'warning',
    });
  }

  // ── No roles in script ────────────────────────────────────────────────────
  if (state.script.length === 0) {
    warnings.push({
      type: 'empty-script',
      message: `No script has been set for this game.`,
      severity: 'warning',
    });
  }

  return {
    ...ctx,
    resolution: {
      ...resolution,
      warnings,
    },
  };
}
