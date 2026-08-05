/**
 * Night Resolution Page
 *
 * Runs the rule engine against the completed night's actions and presents
 * the Storyteller with suggested outcomes. Every suggestion can be overridden
 * before committing to the database.
 *
 * Flow:
 *   1. Load room, players, reminder tokens, night actions from Supabase
 *   2. Run resolveNight() client-side (pure, no network calls)
 *   3. Display events timeline + override controls
 *   4. Storyteller confirms → apply deaths, role changes to DB
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadSession } from '../lib/roomUtils';
import { recordNightResolution, recordEvent } from '../lib/gameHistory';
import { resolveNight, buildActionMap } from '../engine/pipeline';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import { getNightNumber } from '../data/nightOrder';
import { detectWinCondition, detectScarletWomanPromotion, type WinDetection, type DemonPromotion } from '../lib/winConditions';
import type { Player, Room, ReminderToken, NightAction, DayEvent } from '../types';
import type { NightResolution, ResolutionEvent, NightActionMap } from '../engine/types';

const EVENT_ICONS: Record<string, string> = {
  death:      '†',
  protection: '🛡',
  poison:     '☠',
  transform:  '⇄',
  info:       'ℹ',
  trigger:    '⚡',
  advisory:   '•',
};

const EVENT_COLORS: Record<string, string> = {
  death:      'var(--danger)',
  protection: 'var(--team-townsfolk)',
  poison:     'var(--team-minion)',
  transform:  'var(--accent)',
  info:       'var(--team-outsider)',
  trigger:    '#a070d0',
  advisory:   'var(--muted)',
};

export function NightResolutionPage() {
  const [room, setRoom]                     = useState<Room | null>(null);
  const [players, setPlayers]               = useState<Player[]>([]);
  const [resolution, setResolution]         = useState<NightResolution | null>(null);
  const [actionMap, setActionMap]           = useState<NightActionMap>({});
  const [overriddenDeaths, setOverriddenDeaths] = useState<Set<string>>(new Set());
  const [roleOverrides, setRoleOverrides]   = useState<Map<string, string>>(new Map());
  const [infoOverrideIndexes, setInfoOverrideIndexes] = useState<Set<number>>(new Set());
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [committed, setCommitted]           = useState(false);
  const [winAlert, setWinAlert]             = useState<WinDetection | null>(null);
  const [demonPromotion, setDemonPromotion] = useState<DemonPromotion | null>(null);
  const [endingGame, setEndingGame]         = useState(false);
  const navigate = useNavigate();

  const session = loadSession();

  useEffect(() => {
    if (!session?.isHost) navigate('/game');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session?.isHost) return null;

  const { roomId } = session;

  // ── Load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('id, code, status, script, host_id, phase, night_step_key, created_at')
        .eq('id', roomId)
        .single();

      if (!roomData || roomData.status !== 'in_progress') {
        navigate('/game');
        return;
      }
      const r = roomData as Room;
      setRoom(r);

      const nightNum   = getNightNumber(r.phase);
      const isNight    = r.phase.startsWith('Night');
      const resolveNum = isNight ? nightNum : nightNum; // resolve current night

      const [
        { data: playerData },
        { data: tokenData },
        { data: actionData },
        { data: dayEventData },
      ] = await Promise.all([
        supabase
          .from('players')
          .select('id, display_name, seat_order, is_host, role, is_alive, ghost_vote_used, notes, room_id, created_at')
          .eq('room_id', roomId)
          .eq('is_host', false)
          .order('seat_order'),
        supabase
          .from('reminder_tokens')
          .select('id, player_id, room_id, token_key, created_at')
          .eq('room_id', roomId),
        supabase
          .from('night_actions')
          .select('id, room_id, night_number, step_key, target_ids, notes, created_at, updated_at')
          .eq('room_id', roomId)
          .eq('night_number', resolveNum),
        supabase
          .from('day_events')
          .select('id, room_id, day_number, event_type, payload, created_at')
          .eq('room_id', roomId)
          .eq('day_number', resolveNum - 1) // day before this night
          .eq('event_type', 'execution'),
      ]);

      const loadedPlayers  = (playerData  ?? []) as Player[];
      const loadedTokens   = (tokenData   ?? []) as ReminderToken[];
      const loadedActions  = (actionData  ?? []) as NightAction[];
      const dayEvents      = (dayEventData ?? []) as DayEvent[];

      setPlayers(loadedPlayers);

      // Find executed player from previous day (for Undertaker)
      const executedPlayerId = dayEvents.find(
        (e) => e.event_type === 'execution',
      )?.payload?.player_id;

      // Run the rule engine
      const gameState = {
        roomId,
        players: loadedPlayers,
        reminderTokens: loadedTokens,
        nightNumber: resolveNum,
        script: Array.isArray(r.script) ? (r.script as string[]) : [],
        executedPlayerId,
      };

      const builtActionMap = buildActionMap(loadedActions);
      const res = resolveNight(gameState, builtActionMap);
      setResolution(res);
      setActionMap(builtActionMap);

      // Pre-populate override controls with engine suggestions
      setOverriddenDeaths(new Set(res.deaths));
      setRoleOverrides(new Map(res.roleChanges));

      setLoading(false);
    }
    load();
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Override handlers ─────────────────────────────────────────────────

  const toggleDeath = useCallback((playerId: string) => {
    setOverriddenDeaths((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }, []);

  const toggleRoleChange = useCallback((playerId: string, suggested: string) => {
    setRoleOverrides((prev) => {
      const next = new Map(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.set(playerId, suggested);
      return next;
    });
  }, []);

  const toggleInfoOverride = useCallback((index: number) => {
    setInfoOverrideIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // ── Commit ────────────────────────────────────────────────────────────

  async function handleCommit() {
    if (!room || saving) return;
    setSaving(true);

    try {
      const ops: PromiseLike<unknown>[] = [];

      // Apply deaths
      for (const playerId of overriddenDeaths) {
        ops.push(
          supabase.from('players')
            .update({ is_alive: false })
            .eq('id', playerId),
        );
      }

      // Apply role changes
      for (const [playerId, newRole] of roleOverrides) {
        ops.push(
          supabase.from('players')
            .update({ role: newRole })
            .eq('id', playerId),
        );
      }

      await Promise.all(ops);

      // ── Win condition check after night deaths ────────────────────────
      // Build the resulting player list reflecting committed deaths + role changes
      const updatedPlayers = players.map((p) => {
        let updated = { ...p };
        if (overriddenDeaths.has(p.id))  updated = { ...updated, is_alive: false };
        if (roleOverrides.has(p.id))     updated = { ...updated, role: roleOverrides.get(p.id)! };
        return updated;
      });

      const promotion = detectScarletWomanPromotion(updatedPlayers);
      if (promotion) {
        setDemonPromotion(promotion);
      } else {
        const win = detectWinCondition(updatedPlayers);
        if (win) setWinAlert(win);
      }
      // ─────────────────────────────────────────────────────────────────

      // Record history (fire-and-forget — never blocks commit)
      if (resolution) {
        void recordNightResolution({
          roomId,
          phase: room.phase,
          nightNumber: getNightNumber(room.phase),
          actions: actionMap,
          resolution,
          committedDeaths: overriddenDeaths,
          committedRoleChanges: roleOverrides,
          players,
        });

        // Record ST overrides for info suggestions
        for (const idx of infoOverrideIndexes) {
          const suggestion = resolution.infoSuggestions[idx];
          if (!suggestion) continue;
          const char = TROUBLE_BREWING.find((c) => c.id === suggestion.characterId);
          const player = players.find((p) => p.id === suggestion.playerId);
          void recordEvent({
            roomId,
            phase: room.phase,
            type: 'st_override',
            description: `Storyteller gave different information to ${char?.name ?? suggestion.characterId} (${player?.display_name ?? suggestion.playerId}). Engine suggested: "${suggestion.suggestion}"`,
            playerIds: [suggestion.playerId],
            metadata: { field: 'infoSuggestion', characterId: suggestion.characterId, engineSuggested: suggestion.suggestion, stChoice: 'different' },
          });
        }
      }

      // Advance to day phase
      const nightNum = getNightNumber(room.phase);
      const newPhase = `Day ${nightNum}`;
      await supabase.from('rooms')
        .update({ phase: newPhase, night_step_key: null })
        .eq('id', roomId);

      setCommitted(true);
    } finally {
      setSaving(false);
    }
  }

  // ── Post-commit actions ───────────────────────────────────────────────

  async function handleEndGame(outcome: 'good' | 'evil') {
    if (!room) return;
    setEndingGame(true);
    await supabase
      .from('rooms')
      .update({ status: 'completed', outcome, ended_at: new Date().toISOString() })
      .eq('id', roomId);
    setEndingGame(false);
    navigate('/win');
  }

  async function handlePromoteScarletWoman(swId: string) {
    await supabase.from('players').update({ role: 'imp' }).eq('id', swId);
    setDemonPromotion(null);
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page centered">
        <p className="text-muted">Running rule engine…</p>
      </div>
    );
  }

  if (!resolution) return null;

  const nightNum = room ? getNightNumber(room.phase) : 1;
  const errors   = resolution.warnings.filter((w) => w.severity === 'error');
  const warnings = resolution.warnings.filter((w) => w.severity === 'warning');

  if (committed) {
    return (
      <div className="resolve-page">
        <header className="resolve-header">
          <button className="night-back-btn" onClick={() => navigate('/game')}>← Grimoire</button>
          <span className="resolve-header-title">Night {nightNum} Resolved</span>
          <span />
        </header>
        <div className="resolve-committed">
          <div className="resolve-committed-icon">☀</div>
          <h2>Morning Announcement</h2>
          {overriddenDeaths.size === 0 ? (
            <p className="resolve-summary-text">Nobody died last night.</p>
          ) : (
            <p className="resolve-summary-text">
              {[...overriddenDeaths].map((id) => {
                const p = players.find((pl) => pl.id === id);
                return p?.display_name ?? id;
              }).join(', ')} died last night.
            </p>
          )}
          <button
            className="btn btn-primary"
            style={{ marginTop: 24 }}
            onClick={() => navigate('/day')}
          >
            Go to Day {nightNum}
          </button>
        </div>

        {/* Scarlet Woman Demon Promotion */}
        {demonPromotion && (
          <div className="modal-overlay">
            <div className="modal-card win-alert-modal">
              <div className="win-alert-badge win-alert-badge--evil">Demon Succession</div>
              <h2 className="modal-title">Scarlet Woman Rises</h2>
              <p className="modal-subtitle win-alert-reason">
                The Demon has died with 5+ players alive.{' '}
                <strong>{demonPromotion.playerName}</strong> (Scarlet Woman) secretly becomes the new Demon.
              </p>
              <p className="win-alert-hint">
                The game continues. Update her token and wake her next night as the Imp.
              </p>
              <div className="end-game-options">
                <button
                  className="btn end-game-btn end-game-evil"
                  onClick={() => void handlePromoteScarletWoman(demonPromotion.playerId)}
                >
                  Promote {demonPromotion.playerName} → Imp
                </button>
                <button className="btn btn-secondary" onClick={() => setDemonPromotion(null)}>
                  Handle Manually
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Win Condition Alert */}
        {winAlert && (
          <div className="modal-overlay">
            <div className="modal-card win-alert-modal">
              <div className={`win-alert-badge win-alert-badge--${winAlert.outcome}`}>
                {winAlert.outcome === 'good' ? 'Good Wins' : 'Evil Wins'}
              </div>
              <h2 className="modal-title">Win Condition Detected</h2>
              <p className="modal-subtitle win-alert-reason">{winAlert.reason}</p>
              <p className="win-alert-hint">
                Confirm to end the game, or continue if this was triggered by error.
              </p>
              <div className="end-game-options">
                <button
                  className={`btn end-game-btn ${winAlert.outcome === 'good' ? 'end-game-good' : 'end-game-evil'}`}
                  onClick={() => { setWinAlert(null); void handleEndGame(winAlert.outcome); }}
                  disabled={endingGame}
                >
                  End Game — {winAlert.outcome === 'good' ? 'Good Wins' : 'Evil Wins'}
                </button>
                <button className="btn btn-secondary" onClick={() => setWinAlert(null)}>
                  Continue Anyway
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="resolve-page">
      {/* ── Header ── */}
      <header className="resolve-header">
        <button className="night-back-btn" onClick={() => navigate('/night')}>
          ← Night
        </button>
        <span className="resolve-header-title">Night {nightNum} Resolution</span>
        <span />
      </header>

      <div className="resolve-body">
        {/* ── Validation warnings ── */}
        {(errors.length > 0 || warnings.length > 0) && (
          <section className="resolve-warnings">
            {errors.map((w, i) => (
              <div key={i} className="resolve-warning resolve-warning--error">
                ⚠ {w.message}
              </div>
            ))}
            {warnings.map((w, i) => (
              <div key={i} className="resolve-warning resolve-warning--warn">
                ℹ {w.message}
              </div>
            ))}
          </section>
        )}

        {/* ── Deaths override ── */}
        <section className="resolve-section">
          <h3 className="resolve-section-title">Deaths Tonight</h3>
          <p className="resolve-section-hint">
            Toggle each player — green = dies, grey = survives.
            Override the engine's suggestion freely.
          </p>
          {players.length === 0 ? (
            <p className="text-muted">No players loaded.</p>
          ) : (
            <div className="resolve-player-grid">
              {players.map((p) => {
                const suggested  = resolution.deaths.has(p.id);
                const willDie    = overriddenDeaths.has(p.id);
                const char       = TROUBLE_BREWING.find((c) => c.id === p.role);
                const isOverride = willDie !== suggested;
                return (
                  <button
                    key={p.id}
                    className={[
                      'resolve-player-btn',
                      willDie    && 'resolve-player-btn--dies',
                      isOverride && 'resolve-player-btn--override',
                    ].filter(Boolean).join(' ')}
                    onClick={() => toggleDeath(p.id)}
                  >
                    <span className="resolve-player-name">{p.display_name}</span>
                    <span className="resolve-player-role">{char?.name ?? p.role ?? '?'}</span>
                    <span className="resolve-player-status">
                      {willDie ? '† dies' : 'survives'}
                      {isOverride ? ' (override)' : ' (suggested)'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Role changes ── */}
        {resolution.roleChanges.size > 0 && (
          <section className="resolve-section">
            <h3 className="resolve-section-title">Role Changes</h3>
            <p className="resolve-section-hint">
              Toggle each change — gold = apply, grey = skip.
            </p>
            {[...resolution.roleChanges.entries()].map(([playerId, newRole]) => {
              const player    = players.find((p) => p.id === playerId);
              const newChar   = TROUBLE_BREWING.find((c) => c.id === newRole);
              const willApply = roleOverrides.has(playerId);
              return (
                <button
                  key={playerId}
                  className={[
                    'resolve-change-btn',
                    willApply && 'resolve-change-btn--active',
                  ].filter(Boolean).join(' ')}
                  onClick={() => toggleRoleChange(playerId, newRole)}
                >
                  <span className="resolve-change-player">{player?.display_name ?? playerId}</span>
                  <span className="resolve-change-arrow">→</span>
                  <span className="resolve-change-role">{newChar?.name ?? newRole}</span>
                  <span className="resolve-change-status">
                    {willApply ? 'will apply' : 'skipped'}
                  </span>
                </button>
              );
            })}
          </section>
        )}

        {/* ── Info suggestions ── */}
        {resolution.infoSuggestions.length > 0 && (
          <section className="resolve-section">
            <h3 className="resolve-section-title">Information to Give</h3>
            <div className="resolve-info-list">
              {resolution.infoSuggestions.map((s, i) => {
                const char       = TROUBLE_BREWING.find((c) => c.id === s.characterId);
                const player     = players.find((p) => p.id === s.playerId);
                const overridden = infoOverrideIndexes.has(i);
                return (
                  <div
                    key={i}
                    className={[
                      'resolve-info-item',
                      !s.abilityWorking && 'resolve-info-item--impaired',
                      overridden        && 'resolve-info-item--overridden',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="resolve-info-char">{char?.name ?? s.characterId}</span>
                    <span className="resolve-info-player">({player?.display_name ?? s.playerId})</span>
                    <span className="resolve-info-suggestion">{s.suggestion}</span>
                    <button
                      className={`resolve-info-override-btn${overridden ? ' active' : ''}`}
                      onClick={() => toggleInfoOverride(i)}
                      title="Mark that you gave different information"
                    >
                      {overridden ? 'Override ✓' : 'I gave different info'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Event timeline ── */}
        <section className="resolve-section">
          <h3 className="resolve-section-title">Event Log</h3>
          <div className="resolve-timeline">
            {resolution.events.map((event: ResolutionEvent) => (
              <div key={event.id} className={`resolve-event resolve-event--${event.type}`}>
                <span
                  className="resolve-event-icon"
                  style={{ color: EVENT_COLORS[event.type] ?? 'var(--muted)' }}
                >
                  {EVENT_ICONS[event.type] ?? '•'}
                </span>
                <span className="resolve-event-desc">{event.description}</span>
              </div>
            ))}
            {resolution.events.length === 0 && (
              <p className="text-muted">No events recorded.</p>
            )}
          </div>
        </section>

        {/* ── Commit ── */}
        <div className="resolve-commit-area">
          <p className="resolve-commit-summary">
            {overriddenDeaths.size === 0
              ? 'Nobody will die tonight.'
              : `${overriddenDeaths.size} player${overriddenDeaths.size > 1 ? 's' : ''} will die.`}
            {roleOverrides.size > 0
              ? ` ${roleOverrides.size} role change${roleOverrides.size > 1 ? 's' : ''} will apply.`
              : ''}
          </p>
          <button
            className="btn btn-primary resolve-commit-btn"
            onClick={handleCommit}
            disabled={saving}
          >
            {saving ? 'Committing…' : 'Commit & Start Day'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ marginTop: 8 }}
            onClick={() => navigate('/night')}
          >
            Back to Night
          </button>
        </div>
      </div>
    </div>
  );
}
