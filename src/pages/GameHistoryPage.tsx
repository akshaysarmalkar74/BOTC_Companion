/**
 * Game History Page (/history)
 *
 * A full-game timeline and event log for the Storyteller.
 *
 * Panels:
 *  Left  — Phase timeline (Setup → Night 1 → Day 1 → …) + Player list
 *  Right — Events for the selected phase, with search/filter
 *          Switches to Player Journey when a player is selected.
 *
 * Replay Mode — step through phases one at a time (read-only).
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadSession } from '../lib/roomUtils';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import type { Player, Room, GameEvent, GameEventType } from '../types';

// ── Phase ordering ────────────────────────────────────────────────────────────

function phaseOrder(phase: string): number {
  if (phase === 'Setup') return 0;
  const m = phase.match(/^(Night|Day) (\d+)$/);
  if (!m) return 9999;
  const n = parseInt(m[2]);
  const isNight = m[1] === 'Night';
  return n * 2 - (isNight ? 1 : 0);
  // Night 1 = 1, Day 1 = 2, Night 2 = 3, Day 2 = 4, …
}

function sortedPhases(phases: string[]): string[] {
  return [...phases].sort((a, b) => phaseOrder(a) - phaseOrder(b));
}

// ── Event display metadata ────────────────────────────────────────────────────

const EVENT_META: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  game_start:            { icon: '★',  color: 'var(--accent)',          label: 'Game Start'      },
  role_assigned:         { icon: '♦',  color: 'var(--team-townsfolk)',  label: 'Role Assigned'   },
  night_action:          { icon: '🌙', color: 'var(--muted)',           label: 'Night Action'    },
  resolution_death:      { icon: '†',  color: 'var(--danger)',          label: 'Death'           },
  resolution_protection: { icon: '🛡', color: 'var(--team-townsfolk)',  label: 'Protection'      },
  resolution_poison:     { icon: '☠',  color: 'var(--team-minion)',     label: 'Poison'          },
  resolution_transform:  { icon: '⇄',  color: 'var(--accent)',          label: 'Role Change'     },
  resolution_info:       { icon: 'ℹ',  color: 'var(--team-outsider)',   label: 'Information'     },
  resolution_advisory:   { icon: '•',  color: 'var(--muted)',           label: 'Advisory'        },
  st_override:           { icon: '⚠',  color: 'var(--accent)',          label: 'ST Override'     },
  morning_announcement:  { icon: '☀',  color: 'var(--accent)',          label: 'Morning'         },
  nomination:            { icon: '➤',  color: 'var(--team-outsider)',   label: 'Nomination'      },
  execution:             { icon: '✝',  color: 'var(--danger)',          label: 'Execution'       },
  player_death:          { icon: '†',  color: 'var(--danger)',          label: 'Death'           },
  ghost_vote_used:       { icon: '✗',  color: 'var(--muted)',           label: 'Ghost Vote'      },
  reminder_added:        { icon: '◉',  color: 'var(--muted)',           label: 'Token Added'     },
  reminder_removed:      { icon: '○',  color: 'var(--muted)',           label: 'Token Removed'   },
  day_note:              { icon: '✎',  color: 'var(--muted)',           label: 'Notes'           },
};

const ALL_EVENT_TYPES = Object.keys(EVENT_META) as GameEventType[];

// ── Component ─────────────────────────────────────────────────────────────────

export function GameHistoryPage() {
  const [room, setRoom]             = useState<Room | null>(null);
  const [players, setPlayers]       = useState<Player[]>([]);
  const [events, setEvents]         = useState<GameEvent[]>([]);
  const [loading, setLoading]       = useState(true);

  // Selection
  const [selectedPhase, setSelectedPhase]       = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Replay mode
  const [replayMode, setReplayMode]   = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);

  // Filters
  const [filterText, setFilterText]   = useState('');
  const [filterType, setFilterType]   = useState<GameEventType | ''>('');

  const navigate = useNavigate();
  const session  = loadSession();

  useEffect(() => {
    if (!session?.isHost) navigate('/game');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session?.isHost) return null;
  const { roomId } = session;

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [{ data: roomData }, { data: playerData }, { data: eventData }] =
        await Promise.all([
          supabase
            .from('rooms')
            .select('id, code, status, script, host_id, phase, night_step_key, created_at')
            .eq('id', roomId)
            .single(),
          supabase
            .from('players')
            .select('id, display_name, seat_order, is_host, role, is_alive, ghost_vote_used, notes, room_id, created_at')
            .eq('room_id', roomId)
            .eq('is_host', false)
            .order('seat_order'),
          supabase
            .from('game_events')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at'),
        ]);

      if (!roomData) { navigate('/game'); return; }
      setRoom(roomData as Room);
      setPlayers((playerData ?? []) as Player[]);
      setEvents((eventData ?? []) as GameEvent[]);
      setLoading(false);
    }
    load();
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ────────────────────────────────────────────────────────────

  const allPhases = useMemo(() => {
    const fromEvents = new Set(events.map((e) => e.phase));
    if (room) fromEvents.add(room.phase); // always show current phase
    return sortedPhases([...fromEvents]);
  }, [events, room]);

  const activePhase = replayMode
    ? allPhases[replayIndex] ?? ''
    : (selectedPhase || allPhases[allPhases.length - 1]) ?? '';

  // Events for current view (phase or player journey)
  const phaseEvents = useMemo(() => {
    let base = selectedPlayerId
      ? events.filter((e) => e.affected_player_ids.includes(selectedPlayerId))
      : events.filter((e) => e.phase === activePhase);

    if (filterType) base = base.filter((e) => e.event_type === filterType);
    if (filterText) {
      const q = filterText.toLowerCase();
      base = base.filter((e) => e.description.toLowerCase().includes(q));
    }
    return base;
  }, [events, activePhase, selectedPlayerId, filterText, filterType]);

  // Player alive/dead
  function isPlayerAlive(p: Player) { return p.is_alive; }

  function playerRole(p: Player) {
    return TROUBLE_BREWING.find((c) => c.id === p.role)?.name ?? p.role ?? '?';
  }

  // ── Replay controls ──────────────────────────────────────────────────────────

  function startReplay() {
    setReplayMode(true);
    setReplayIndex(0);
    setSelectedPlayerId(null);
  }

  function exitReplay() {
    setReplayMode(false);
    setSelectedPhase(activePhase);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page centered">
        <p className="text-muted">Loading history…</p>
      </div>
    );
  }

  return (
    <div className="history-page">
      {/* ── Header ── */}
      <header className="history-header">
        <button className="night-back-btn" onClick={() => navigate('/game')}>
          ← Grimoire
        </button>
        <span className="history-header-title">
          Game History{room ? ` · Room ${room.code}` : ''}
        </span>
        {replayMode ? (
          <button className="btn btn-secondary history-replay-exit" onClick={exitReplay}>
            Exit Replay
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={startReplay}>
            Replay
          </button>
        )}
      </header>

      {/* ── Replay controls ── */}
      {replayMode && (
        <div className="history-replay-bar">
          <button
            className="replay-nav-btn"
            onClick={() => setReplayIndex((i) => Math.max(0, i - 1))}
            disabled={replayIndex === 0}
          >
            ← Prev
          </button>
          <span className="replay-phase-label">{activePhase}</span>
          <button
            className="replay-nav-btn"
            onClick={() => setReplayIndex((i) => Math.min(allPhases.length - 1, i + 1))}
            disabled={replayIndex >= allPhases.length - 1}
          >
            Next →
          </button>
          <span className="replay-counter">
            {replayIndex + 1} / {allPhases.length}
          </span>
        </div>
      )}

      <div className="history-body">
        {/* ── Left panel: Timeline + Players ── */}
        <aside className="history-sidebar">
          <section className="history-sidebar-section">
            <h3 className="history-sidebar-title">Timeline</h3>
            <div className="history-timeline">
              {allPhases.map((phase) => {
                const isActive  = phase === activePhase && !selectedPlayerId;
                const isCurrent = phase === room?.phase;
                const hasEvents = events.some((e) => e.phase === phase);
                return (
                  <button
                    key={phase}
                    className={[
                      'history-timeline-item',
                      isActive && 'history-timeline-item--active',
                      isCurrent && 'history-timeline-item--current',
                    ].filter(Boolean).join(' ')}
                    onClick={() => {
                      setSelectedPhase(phase);
                      setSelectedPlayerId(null);
                      if (replayMode) setReplayIndex(allPhases.indexOf(phase));
                    }}
                  >
                    <span className="history-timeline-dot">
                      {isCurrent ? '▶' : hasEvents ? '●' : '○'}
                    </span>
                    <span className="history-timeline-label">{phase}</span>
                    {isCurrent && (
                      <span className="history-timeline-now">now</span>
                    )}
                  </button>
                );
              })}
              {allPhases.length === 0 && (
                <p className="text-muted" style={{ fontSize: '0.8125rem', padding: '8px 0' }}>
                  No events recorded yet.
                </p>
              )}
            </div>
          </section>

          <section className="history-sidebar-section" style={{ marginTop: 16 }}>
            <h3 className="history-sidebar-title">Players</h3>
            <div className="history-player-list">
              {players.map((p) => {
                const isSelected = selectedPlayerId === p.id;
                const alive      = isPlayerAlive(p);
                return (
                  <button
                    key={p.id}
                    className={[
                      'history-player-item',
                      isSelected && 'history-player-item--selected',
                      !alive && 'history-player-item--dead',
                    ].filter(Boolean).join(' ')}
                    onClick={() =>
                      setSelectedPlayerId((prev) => (prev === p.id ? null : p.id))
                    }
                  >
                    <span className="history-player-name">{p.display_name}</span>
                    <span className="history-player-role">{playerRole(p)}</span>
                    {!alive && <span className="history-player-dead">†</span>}
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        {/* ── Right panel: Events ── */}
        <main className="history-main">
          {/* Panel title */}
          <div className="history-main-header">
            {selectedPlayerId ? (
              <div className="history-journey-header">
                <h2 className="history-main-title">
                  {players.find((p) => p.id === selectedPlayerId)?.display_name ?? '?'}'s Journey
                </h2>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8125rem', padding: '4px 10px' }}
                  onClick={() => setSelectedPlayerId(null)}
                >
                  ✕ Close
                </button>
              </div>
            ) : (
              <h2 className="history-main-title">{activePhase || 'Select a phase'}</h2>
            )}

            {/* Filters */}
            <div className="history-filters">
              <input
                className="history-filter-input"
                type="text"
                placeholder="Search events…"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
              <select
                className="history-filter-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as GameEventType | '')}
              >
                <option value="">All types</option>
                {ALL_EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_META[t]?.label ?? t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Player journey: group by phase */}
          {selectedPlayerId ? (
            <PlayerJourneyView
              events={phaseEvents}
              allPhases={allPhases}
            />
          ) : (
            <EventListView events={phaseEvents} players={players} />
          )}
        </main>
      </div>
    </div>
  );
}

// ── EventListView ─────────────────────────────────────────────────────────────

function EventListView({
  events,
  players,
}: {
  events: GameEvent[];
  players: Player[];
}) {
  if (events.length === 0) {
    return (
      <div className="history-empty">
        <p>No events to display.</p>
        <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: 4 }}>
          Events are recorded as you play through the night and day phases.
        </p>
      </div>
    );
  }

  return (
    <div className="history-event-list">
      {events.map((event) => (
        <EventItem key={event.id} event={event} players={players} />
      ))}
    </div>
  );
}

// ── PlayerJourneyView ─────────────────────────────────────────────────────────

function PlayerJourneyView({
  events,
  allPhases,
}: {
  events: GameEvent[];
  allPhases: string[];
}) {
  if (events.length === 0) {
    return (
      <div className="history-empty">
        <p>No events recorded for this player yet.</p>
      </div>
    );
  }

  // Group by phase, maintaining phase order
  const byPhase = new Map<string, GameEvent[]>();
  for (const event of events) {
    const bucket = byPhase.get(event.phase) ?? [];
    bucket.push(event);
    byPhase.set(event.phase, bucket);
  }

  const orderedPhases = allPhases.filter((p) => byPhase.has(p));

  return (
    <div className="history-journey">
      {orderedPhases.map((phase) => (
        <div key={phase} className="history-journey-phase">
          <h3 className="history-journey-phase-title">{phase}</h3>
          {(byPhase.get(phase) ?? []).map((event) => (
            <EventItem key={event.id} event={event} players={[]} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── EventItem ─────────────────────────────────────────────────────────────────

function EventItem({
  event,
}: {
  event: GameEvent;
  players: Player[];
}) {
  const meta = EVENT_META[event.event_type] ?? { icon: '•', color: 'var(--muted)', label: event.event_type };
  const isOverride = event.event_type === 'st_override';
  const isDeath    = event.event_type === 'resolution_death' || event.event_type === 'player_death' || event.event_type === 'execution';

  // Expand day_note metadata for readability
  const noteContent = event.event_type === 'day_note'
    ? (event.metadata?.notes as string | undefined)
    : undefined;

  return (
    <div
      className={[
        'history-event',
        isOverride && 'history-event--override',
        isDeath    && 'history-event--death',
      ].filter(Boolean).join(' ')}
    >
      <span
        className="history-event-icon"
        style={{ color: meta.color }}
      >
        {meta.icon}
      </span>
      <div className="history-event-body">
        <span className="history-event-desc">{event.description}</span>
        {noteContent && (
          <blockquote className="history-event-note">{noteContent}</blockquote>
        )}
        {isOverride && (
          <span className="history-event-override-tag">Storyteller override</span>
        )}
      </div>
    </div>
  );
}
