/**
 * Game History library — event writing and export architecture.
 *
 * All functions write to the game_events table in Supabase.
 * They are fire-and-forget: errors are logged but never thrown,
 * so a history write failure never blocks gameplay.
 *
 * Design goal: every caller is simple. The complex logic of what to
 * record lives here, not scattered across pages.
 */

import { supabase } from './supabase';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import { NIGHT_STEPS } from '../data/nightOrder';
import type { GameEventType, GameHistoryExport, Player, Room } from '../types';
import type { NightResolution } from '../engine/types';
import type { NightActionMap } from '../engine/types';

// ── Low-level writer ──────────────────────────────────────────────────────────

export async function recordEvent(params: {
  roomId: string;
  phase: string;
  type: GameEventType;
  description: string;
  playerIds?: string[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('game_events').insert({
    room_id:             params.roomId,
    phase:               params.phase,
    event_type:          params.type,
    description:         params.description,
    affected_player_ids: params.playerIds ?? [],
    metadata:            params.metadata  ?? {},
  });

  if (error) {
    console.warn('[gameHistory] Failed to record event:', error.message, params);
  }
}

// ── Game start ────────────────────────────────────────────────────────────────

/**
 * Record game start and all role assignments atomically.
 * Called from RoleAssignmentPage when the Storyteller starts the game.
 */
export async function recordGameStart(
  roomId: string,
  players: Player[],
  assignments: Record<string, string>,
  script: string[],
): Promise<void> {
  const events: Parameters<typeof supabase.from>[0] extends 'game_events'
    ? never
    : {
        room_id: string;
        phase: string;
        event_type: string;
        description: string;
        affected_player_ids: string[];
        metadata: Record<string, unknown>;
      }[] = [];

  // Manually build insert rows to do one batch insert
  const rows: {
    room_id: string;
    phase: string;
    event_type: string;
    description: string;
    affected_player_ids: string[];
    metadata: Record<string, unknown>;
  }[] = [];

  // Game start
  rows.push({
    room_id:             roomId,
    phase:               'Setup',
    event_type:          'game_start',
    description:         `Game started with ${players.length} players.`,
    affected_player_ids: players.map((p) => p.id),
    metadata:            { playerCount: players.length, script },
  });

  // One row per player assignment
  for (const player of players) {
    const charId = assignments[player.id];
    if (!charId) continue;
    const char = TROUBLE_BREWING.find((c) => c.id === charId);
    rows.push({
      room_id:             roomId,
      phase:               'Setup',
      event_type:          'role_assigned',
      description:         `${player.display_name} was assigned ${char?.name ?? charId}.`,
      affected_player_ids: [player.id],
      metadata:            { roleId: charId, roleName: char?.name ?? charId, team: char?.team ?? '' },
    });
  }

  const { error } = await supabase.from('game_events').insert(rows);
  if (error) {
    console.warn('[gameHistory] Failed to record game start:', error.message);
  }

  void events; // suppress unused var warning
}

// ── Night resolution ──────────────────────────────────────────────────────────

/**
 * Called from NightResolutionPage after the Storyteller commits the resolution.
 *
 * Records:
 *  1. Night actions (what roles did during the night)
 *  2. Engine resolution events (deaths, protections, transforms, info)
 *  3. ST overrides (where the ST changed the engine's suggestion)
 *  4. Morning announcement (final death list)
 */
export async function recordNightResolution(params: {
  roomId: string;
  phase: string;
  nightNumber: number;
  actions: NightActionMap;
  resolution: NightResolution;
  /** Deaths the ST actually committed (may differ from resolution.deaths) */
  committedDeaths: Set<string>;
  /** Role changes the ST actually applied */
  committedRoleChanges: Map<string, string>;
  players: Player[];
}): Promise<void> {
  const {
    roomId, phase, actions, resolution,
    committedDeaths, committedRoleChanges, players,
  } = params;

  const rows: {
    room_id: string;
    phase: string;
    event_type: string;
    description: string;
    affected_player_ids: string[];
    metadata: Record<string, unknown>;
  }[] = [];

  function playerName(id: string) {
    return players.find((p) => p.id === id)?.display_name ?? id;
  }

  // 1. Night actions
  for (const [stepKey, action] of Object.entries(actions)) {
    if (action.target_ids.length === 0) continue;
    const stepDef = NIGHT_STEPS.find((s) => s.key === stepKey);
    const targetNames = action.target_ids.map(playerName).join(' and ');
    rows.push({
      room_id:             roomId,
      phase,
      event_type:          'night_action',
      description:         `${stepDef?.label ?? stepKey} → ${targetNames}.${action.notes ? ` (${action.notes})` : ''}`,
      affected_player_ids: action.target_ids,
      metadata:            { stepKey, targetIds: action.target_ids, notes: action.notes },
    });
  }

  // 2. Engine resolution events
  const engineEventTypeMap: Record<string, GameEventType> = {
    death:      'resolution_death',
    protection: 'resolution_protection',
    poison:     'resolution_poison',
    transform:  'resolution_transform',
    info:       'resolution_info',
    trigger:    'resolution_advisory',
    advisory:   'resolution_advisory',
  };

  for (const event of resolution.events) {
    const mapped = engineEventTypeMap[event.type] ?? 'resolution_advisory';
    // Skip summary advisory to avoid duplication with morning announcement
    if (event.description.includes('summary:')) continue;
    rows.push({
      room_id:             roomId,
      phase,
      event_type:          mapped,
      description:         event.description,
      affected_player_ids: event.affectedPlayerIds,
      metadata:            {},
    });
  }

  // 3. ST override events
  // Deaths the engine suggested but ST removed
  for (const engineDeadId of resolution.deaths) {
    if (!committedDeaths.has(engineDeadId)) {
      rows.push({
        room_id:             roomId,
        phase,
        event_type:          'st_override',
        description:         `Storyteller overrode: ${playerName(engineDeadId)} survived (engine suggested death).`,
        affected_player_ids: [engineDeadId],
        metadata:            { field: 'death', engineSuggested: true, stChoice: false },
      });
    }
  }
  // Deaths the ST added that the engine didn't suggest
  for (const stDeadId of committedDeaths) {
    if (!resolution.deaths.has(stDeadId)) {
      rows.push({
        room_id:             roomId,
        phase,
        event_type:          'st_override',
        description:         `Storyteller added death: ${playerName(stDeadId)} dies (engine did not suggest this).`,
        affected_player_ids: [stDeadId],
        metadata:            { field: 'death', engineSuggested: false, stChoice: true },
      });
    }
  }
  // Role change overrides (engine suggested but ST skipped)
  for (const [pid, role] of resolution.roleChanges) {
    if (!committedRoleChanges.has(pid)) {
      rows.push({
        room_id:             roomId,
        phase,
        event_type:          'st_override',
        description:         `Storyteller skipped role change: ${playerName(pid)} stays as-is (engine suggested → ${role}).`,
        affected_player_ids: [pid],
        metadata:            { field: 'roleChange', engineSuggested: role, stChoice: null },
      });
    }
  }

  // 4. Morning announcement
  const deathNames = [...committedDeaths].map(playerName);
  const announcement = deathNames.length === 0
    ? 'Nobody died last night.'
    : `${deathNames.join(', ')} died last night.`;

  rows.push({
    room_id:             roomId,
    phase,
    event_type:          'morning_announcement',
    description:         announcement,
    affected_player_ids: [...committedDeaths],
    metadata:            { deaths: [...committedDeaths] },
  });

  const { error } = await supabase.from('game_events').insert(rows);
  if (error) {
    console.warn('[gameHistory] Failed to record night resolution:', error.message);
  }
}

// ── Day events ────────────────────────────────────────────────────────────────

export async function recordNomination(
  roomId: string,
  phase: string,
  nominatorId: string,
  nomineeId: string,
  players: Player[],
): Promise<void> {
  const nomName  = players.find((p) => p.id === nominatorId)?.display_name ?? nominatorId;
  const nomyName = players.find((p) => p.id === nomineeId)?.display_name   ?? nomineeId;
  await recordEvent({
    roomId, phase,
    type:        'nomination',
    description: `${nomName} nominated ${nomyName}.`,
    playerIds:   [nominatorId, nomineeId],
    metadata:    { nominatorId, nomineeId },
  });
}

export async function recordExecution(
  roomId: string,
  phase: string,
  playerId: string,
  players: Player[],
): Promise<void> {
  const name = players.find((p) => p.id === playerId)?.display_name ?? playerId;
  await recordEvent({
    roomId, phase,
    type:        'execution',
    description: `${name} was executed.`,
    playerIds:   [playerId],
    metadata:    { playerId },
  });
}

export async function recordManualDeath(
  roomId: string,
  phase: string,
  playerId: string,
  players: Player[],
): Promise<void> {
  const name = players.find((p) => p.id === playerId)?.display_name ?? playerId;
  await recordEvent({
    roomId, phase,
    type:        'player_death',
    description: `${name} died (Storyteller manual action).`,
    playerIds:   [playerId],
    metadata:    { playerId },
  });
}

export async function recordDayNote(
  roomId: string,
  phase: string,
  notes: string,
): Promise<void> {
  if (!notes.trim()) return;
  await recordEvent({
    roomId, phase,
    type:        'day_note',
    description: `Storyteller notes saved for ${phase}.`,
    playerIds:   [],
    metadata:    { notes },
  });
}

// ── Game end ──────────────────────────────────────────────────────────────────

export async function recordGameEnd(
  roomId: string,
  phase: string,
  outcome: string,
  players: Player[],
): Promise<void> {
  const label =
    outcome === 'good'      ? 'Good wins!'
    : outcome === 'evil'    ? 'Evil wins!'
    : 'Game cancelled.';
  await recordEvent({
    roomId, phase,
    type:        'game_end',
    description: label,
    playerIds:   players.map((p) => p.id),
    metadata:    { outcome },
  });
}

// ── Export architecture ───────────────────────────────────────────────────────

/**
 * Assembles an export-ready snapshot of the full game history.
 * No UI yet — this data structure is designed for future PDF/share features.
 */
export async function buildExportData(
  room: Room,
  players: Player[],
): Promise<GameHistoryExport> {
  const { data: eventRows } = await supabase
    .from('game_events')
    .select('*')
    .eq('room_id', room.id)
    .order('created_at');

  const events = (eventRows ?? []) as import('../types').GameEvent[];

  // Group by phase in chronological order
  const phaseOrder = new Map<string, number>();
  const phaseGroups = new Map<string, typeof events>();

  for (const event of events) {
    if (!phaseGroups.has(event.phase)) {
      phaseGroups.set(event.phase, []);
      phaseOrder.set(event.phase, phaseGroups.size);
    }
    phaseGroups.get(event.phase)!.push(event);
  }

  const phases = [...phaseGroups.entries()]
    .sort(([a], [b]) => (phaseOrder.get(a) ?? 0) - (phaseOrder.get(b) ?? 0))
    .map(([phase, evts]) => ({
      phase,
      events: evts.map((e) => ({
        type:              e.event_type,
        description:       e.description,
        affectedPlayerIds: e.affected_player_ids,
        metadata:          e.metadata,
        createdAt:         e.created_at,
      })),
    }));

  return {
    exportedAt: new Date().toISOString(),
    room: { id: room.id, code: room.code, createdAt: room.created_at },
    script: Array.isArray(room.script) ? (room.script as string[]) : [],
    players: players.map((p) => ({
      id:        p.id,
      name:      p.display_name,
      role:      p.role,
      isAlive:   p.is_alive,
      seatOrder: p.seat_order,
    })),
    phases,
  };
}
