/**
 * Validation — detects impossible or illegal game states before resolution.
 *
 * Validation runs as the first pipeline stage. Errors are non-fatal:
 * the pipeline continues and returns warnings alongside the resolution.
 * The Storyteller sees the warnings and can decide how to proceed.
 */

import type { PipelineContext, ValidationWarning } from './types';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import { NIGHT_STEPS } from '../data/nightOrder';
import { hasToken } from './stateEngine';

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

  // ── Data-driven targeting rule validation ─────────────────────────────────
  const STEP_BY_KEY = new Map(NIGHT_STEPS.map((s) => [s.key, s]));

  for (const [stepKey, action] of Object.entries(actions)) {
    if (action.target_ids.length === 0) continue;
    const step = STEP_BY_KEY.get(stepKey);
    if (!step || !step.characterId) continue;

    const actorPlayer = state.players.find((p) => p.role === step.characterId);
    if (!actorPlayer) continue;

    // Self-target check (data-driven)
    if (step.selfAllowed === false) {
      for (const targetId of action.target_ids) {
        if (targetId === actorPlayer.id) {
          const char = TROUBLE_BREWING.find((c) => c.id === step.characterId);
          warnings.push({
            type: `${stepKey}-self-target`,
            message: `${char?.name ?? step.characterId} cannot target themselves. Their action targets themselves, which is illegal.`,
            severity: 'error',
          });
        }
      }
    }

    // Dead target check
    if (step.deadAllowed === false) {
      for (const targetId of action.target_ids) {
        const target = state.players.find((p) => p.id === targetId);
        if (target && !target.is_alive) {
          const char = TROUBLE_BREWING.find((c) => c.id === step.characterId);
          warnings.push({
            type: `${stepKey}-dead-target`,
            message: `${char?.name ?? step.characterId} cannot target dead players. "${target.display_name}" is dead.`,
            severity: 'warning',
          });
        }
      }
    }

    // Distinct targets check
    if ((step.targetsMustDiffer ?? (step.targetCount === 2)) && action.target_ids.length === 2) {
      if (action.target_ids[0] === action.target_ids[1]) {
        const char = TROUBLE_BREWING.find((c) => c.id === step.characterId);
        warnings.push({
          type: `${stepKey}-duplicate-targets`,
          message: `${char?.name ?? step.characterId} must choose 2 different players, but the same player was chosen twice.`,
          severity: 'error',
        });
      }
    }

    // Once-per-game check
    if (step.oncePerGameToken) {
      if (hasToken(state, actorPlayer.id, step.oncePerGameToken)) {
        const char = TROUBLE_BREWING.find((c) => c.id === step.characterId);
        warnings.push({
          type: `${stepKey}-already-used`,
          message: `${char?.name ?? step.characterId}'s ability has already been used (once per game). Token "${step.oncePerGameToken}" is present.`,
          severity: 'warning',
        });
      }
    }
  }

  return {
    ...ctx,
    resolution: {
      ...resolution,
      warnings,
    },
  };
}
