import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadSession } from '../lib/roomUtils';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import {
  computeActiveSteps,
  getNightNumber,
} from '../data/nightOrder';
import type { NightStepDef } from '../data/nightOrder';
import type { Player, Room, ReminderToken, NightAction } from '../types';

const TEAM_LABELS: Record<string, string> = {
  townsfolk: 'Townsfolk',
  outsider: 'Outsider',
  minion: 'Minion',
  demon: 'Demon',
};

export function NightAssistantPage() {
  const [room, setRoom]                     = useState<Room | null>(null);
  const [players, setPlayers]               = useState<Player[]>([]);
  const [activeSteps, setActiveSteps]       = useState<NightStepDef[]>([]);
  const [nightActions, setNightActions]     = useState<NightAction[]>([]);
  const [reminderTokens, setReminderTokens] = useState<ReminderToken[]>([]);
  const [currentIndex, setCurrentIndex]     = useState(0);
  const [localTargets, setLocalTargets]     = useState<string[]>([]);
  const [localNotes, setLocalNotes]         = useState('');
  const [localBluffs, setLocalBluffs]       = useState<string[]>([]);
  const [localRoleId, setLocalRoleId]       = useState('');
  const [showReveal, setShowReveal]         = useState(false);
  const [showProgress, setShowProgress]     = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [loading, setLoading]               = useState(true);
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

      const nightNum = getNightNumber(r.phase);
      const isFirst = nightNum === 1 && r.phase.startsWith('Night');

      const [{ data: playerData }, { data: tokenData }, { data: actionData }] =
        await Promise.all([
          supabase
            .from('players')
            .select(
              'id, display_name, seat_order, is_host, role, is_alive, ghost_vote_used, notes, room_id, created_at'
            )
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
            .eq('night_number', nightNum),
        ]);

      const loadedPlayers  = (playerData  ?? []) as Player[];
      let   loadedTokens   = (tokenData   ?? []) as ReminderToken[];
      const loadedActions  = (actionData  ?? []) as NightAction[];

      // ── Ephemeral token cleanup (nights 2+) ───────────────────────────────
      // Poisoner-poisoned and Monk-protected tokens are valid for one night only.
      // If the role is dead or skipped their step, these tokens persist until now.
      // Clear them at the start of each new night to prevent stale state.
      if (!isFirst) {
        const ephemeralKeys = ['poisoner-poisoned', 'monk-protected'];
        const staleTokenIds = loadedTokens
          .filter((t) => ephemeralKeys.includes(t.token_key))
          .map((t) => t.id);
        if (staleTokenIds.length > 0) {
          await supabase.from('reminder_tokens').delete().in('id', staleTokenIds);
          loadedTokens = loadedTokens.filter((t) => !ephemeralKeys.includes(t.token_key));
        }
      }

      setPlayers(loadedPlayers);
      setReminderTokens(loadedTokens);
      setNightActions(loadedActions);

      const scriptIds = Array.isArray(r.script) ? (r.script as string[]) : [];
      const steps = computeActiveSteps(scriptIds, loadedPlayers, isFirst);
      setActiveSteps(steps);

      // Restore position from saved step key
      if (r.night_step_key === 'complete') {
        setCurrentIndex(steps.length);
      } else if (r.night_step_key) {
        const idx = steps.findIndex((s) => s.key === r.night_step_key);
        if (idx >= 0) {
          setCurrentIndex(idx);
          const saved = loadedActions.find((a) => a.step_key === r.night_step_key);
          setLocalTargets(saved?.target_ids ?? []);
          if (saved?.notes) {
            try {
              const parsed = JSON.parse(saved.notes);
              setLocalNotes(parsed.text ?? '');
              setLocalBluffs(parsed.bluffs ?? []);
              setLocalRoleId(parsed.roleId ?? '');
            } catch {
              setLocalNotes(saved.notes);
            }
          }
        }
      }

      setLoading(false);
    }
    load();
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────

  const nightNumber = room ? getNightNumber(room.phase) : 1;
  const currentStep = currentIndex < activeSteps.length ? activeSteps[currentIndex] : null;
  const isComplete  = currentIndex >= activeSteps.length && activeSteps.length > 0;

  function loadStepState(stepKey: string) {
    setShowReveal(false);
    const saved = nightActions.find((a) => a.step_key === stepKey);
    setLocalTargets(saved?.target_ids ?? []);
    if (saved?.notes) {
      try {
        const parsed = JSON.parse(saved.notes);
        setLocalNotes(parsed.text ?? '');
        setLocalBluffs(parsed.bluffs ?? []);
        setLocalRoleId(parsed.roleId ?? '');
      } catch {
        setLocalNotes(saved.notes);
        setLocalBluffs([]);
        setLocalRoleId('');
      }
    } else {
      setLocalNotes('');
      setLocalBluffs([]);
      setLocalRoleId('');
    }
  }

  function handleToggleTarget(playerId: string, max: number) {
    setLocalTargets((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      if (prev.length < max) return [...prev, playerId];
      return [...prev.slice(0, max - 1), playerId]; // replace last
    });
  }

  async function persistStepKey(key: string) {
    await supabase.from('rooms').update({ night_step_key: key }).eq('id', roomId);
  }

  async function placeAutoReminders(step: NightStepDef, targetIds: string[]) {
    if (!room) return;
    const keysToReplace = new Set(step.autoReminders.map((r) => r.tokenKey));
    const oldIds = reminderTokens
      .filter((t) => keysToReplace.has(t.token_key))
      .map((t) => t.id);

    await Promise.all([
      ...oldIds.map((id) => supabase.from('reminder_tokens').delete().eq('id', id)),
      ...step.autoReminders
        .filter((r) => targetIds[r.targetIndex])
        .map((r) =>
          supabase.from('reminder_tokens').insert({
            player_id: targetIds[r.targetIndex],
            room_id: room.id,
            token_key: r.tokenKey,
          })
        ),
    ]);

    // Refresh token list
    const { data: fresh } = await supabase
      .from('reminder_tokens')
      .select('id, player_id, room_id, token_key, created_at')
      .eq('room_id', room.id);
    if (fresh) setReminderTokens(fresh as ReminderToken[]);
  }

  async function saveAction(step: NightStepDef, targets: string[], notes: string) {
    const { data } = await supabase
      .from('night_actions')
      .upsert(
        {
          room_id:      roomId,
          night_number: nightNumber,
          step_key:     step.key,
          target_ids:   targets,
          notes,
          updated_at:   new Date().toISOString(),
        },
        { onConflict: 'room_id,night_number,step_key' }
      )
      .select('id, room_id, night_number, step_key, target_ids, notes, created_at, updated_at')
      .single();

    if (data) {
      const action = data as NightAction;
      setNightActions((prev) => {
        const exists = prev.find((a) => a.step_key === step.key);
        return exists ? prev.map((a) => (a.step_key === step.key ? action : a)) : [...prev, action];
      });
    }
  }

  async function advanceToIndex(nextIdx: number) {
    if (nextIdx >= activeSteps.length) {
      setCurrentIndex(activeSteps.length);
      await persistStepKey('complete');
    } else {
      const nextStep = activeSteps[nextIdx];
      setCurrentIndex(nextIdx);
      loadStepState(nextStep.key);
      await persistStepKey(nextStep.key);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────

  function buildNotesPayload(step: NightStepDef): string {
    if (step.isDemonInfo || step.roleRevealTeam) {
      return JSON.stringify({
        ...(step.isDemonInfo && { bluffs: localBluffs }),
        ...(step.roleRevealTeam && { roleId: localRoleId }),
        ...(localNotes && { text: localNotes }),
      });
    }
    return localNotes;
  }

  async function handleDone() {
    if (!currentStep || saving) return;
    setSaving(true);
    try {
      const notesPayload = buildNotesPayload(currentStep);
      await saveAction(currentStep, localTargets, notesPayload);
      if (currentStep.autoReminders.length > 0) {
        await placeAutoReminders(currentStep, localTargets);
      }
      await advanceToIndex(currentIndex + 1);
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (saving) return;
    await advanceToIndex(currentIndex + 1);
  }

  function handlePrevious() {
    if (currentIndex <= 0) return;
    const prevIdx = currentIndex - 1;
    setCurrentIndex(prevIdx);
    loadStepState(activeSteps[prevIdx].key);
  }

  async function handleStartDay() {
    if (!room) return;
    const newPhase = `Day ${nightNumber}`;
    await supabase
      .from('rooms')
      .update({ phase: newPhase, night_step_key: null })
      .eq('id', roomId);
    navigate('/day');
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page centered">
        <p className="text-muted">Loading night…</p>
      </div>
    );
  }

  // ── Night complete ────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="night-page">
        <header className="night-header">
          <button className="night-back-btn" onClick={() => navigate('/game')}>
            ← Grimoire
          </button>
          <span className="night-header-label">{room?.phase}</span>
          <span />
        </header>
        <div className="night-complete">
          <div className="night-complete-icon">🌙</div>
          <h2 className="night-complete-title">Night {nightNumber} Complete</h2>
          <p className="night-complete-sub">
            All {activeSteps.length} step{activeSteps.length !== 1 ? 's' : ''} recorded.
          </p>
          <button
            className="btn btn-primary night-complete-btn"
            onClick={() => navigate('/resolve')}
          >
            Resolve Night {nightNumber} →
          </button>
          <button
            className="btn btn-secondary"
            style={{ marginTop: 10 }}
            onClick={handleStartDay}
          >
            Skip Resolution · Start Day {nightNumber}
          </button>
          <button
            className="btn btn-secondary"
            style={{ marginTop: 8 }}
            onClick={() => navigate('/game')}
          >
            Back to Grimoire
          </button>
        </div>
      </div>
    );
  }

  if (!currentStep) return null;

  const charDef   = currentStep.characterId
    ? TROUBLE_BREWING.find((c) => c.id === currentStep.characterId) ?? null
    : null;
  const charPlayer = currentStep.characterId
    ? players.find((p) => p.role === currentStep.characterId) ?? null
    : null;

  // Demon bluffs: roles in the script that are NOT assigned to any player
  const assignedRoles = new Set(players.map((p) => p.role).filter(Boolean));
  const scriptIds = room && Array.isArray(room.script) ? (room.script as string[]) : [];
  const bluffPool = TROUBLE_BREWING.filter(
    (c) => scriptIds.includes(c.id) && !assignedRoles.has(c.id)
  );

  // Role reveal: all roles of the required team present in the script
  const roleRevealPool = currentStep.roleRevealTeam
    ? TROUBLE_BREWING.filter(
        (c) => c.team === currentStep.roleRevealTeam && scriptIds.includes(c.id)
      )
    : [];

  const doneLabel = saving
    ? '…'
    : currentIndex === activeSteps.length - 1
    ? 'Finish Night'
    : 'Done →';

  // ── Night step view ───────────────────────────────────────────────────
  return (
    <div className="night-page">
      {/* ── Header ── */}
      <header className="night-header">
        <button className="night-back-btn" onClick={() => navigate('/game')}>
          ← Grimoire
        </button>
        <button
          className="night-header-center"
          onClick={() => setShowProgress((v) => !v)}
          aria-expanded={showProgress}
          aria-label="Toggle progress"
        >
          <span className="night-header-label">{room?.phase}</span>
          <span className="night-header-progress">
            {currentIndex + 1} / {activeSteps.length}
          </span>
        </button>
        <span className="night-header-spacer" />
      </header>

      {/* ── Progress panel (collapsible) ── */}
      {showProgress && (
        <div className="night-progress-panel">
          {activeSteps.map((step, i) => {
            const done = i < currentIndex || nightActions.some((a) => a.step_key === step.key);
            const current = i === currentIndex;
            return (
              <div
                key={step.key}
                className={`night-progress-item${current ? ' current' : done ? ' done' : ''}`}
              >
                <span className="night-progress-icon">
                  {done ? '✓' : current ? '▶' : '○'}
                </span>
                <span className="night-progress-label">{step.label}</span>
                {step.conditional && (
                  <span className="night-progress-cond">conditional</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Step content ── */}
      <main className="night-content">
        <div className="night-step-card">
          {/* Character header */}
          <div className="step-char-header">
            {charDef && (
              <span className={`card-team-badge team-badge-${charDef.team}`}>
                {TEAM_LABELS[charDef.team]}
              </span>
            )}
            <h2 className="step-char-name">{currentStep.label}</h2>
            {charPlayer && (
              <p className="step-player-label">
                Wake <strong>{charPlayer.display_name}</strong>
              </p>
            )}
          </div>

          {/* Conditional warning */}
          {currentStep.conditional && (
            <div className="step-conditional-note">
              ⚠ Conditional — only continue if this applies tonight
            </div>
          )}

          {/* Instruction */}
          <p className="step-instruction">{currentStep.instruction}</p>

          {/* Player selection */}
          {currentStep.targetCount > 0 && (
            <div className="step-player-section">
              <p className="step-select-hint">
                {currentStep.targetCount === 1
                  ? 'Select 1 player'
                  : `Select up to ${currentStep.targetCount} players`}
                {localTargets.length > 0
                  ? ` · ${localTargets.length} selected`
                  : ''}
              </p>
              <div className="step-player-grid">
                {players.map((p) => {
                  const pChar = p.role
                    ? TROUBLE_BREWING.find((c) => c.id === p.role) ?? null
                    : null;
                  const sel = localTargets.includes(p.id);
                  const full =
                    !sel && localTargets.length >= currentStep.targetCount;
                  return (
                    <button
                      key={p.id}
                      className={[
                        'step-player-btn',
                        sel   && 'is-selected',
                        !p.is_alive && 'is-dead',
                        full  && 'is-dimmed',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() =>
                        handleToggleTarget(p.id, currentStep.targetCount)
                      }
                    >
                      <span className="step-player-name">{p.display_name}</span>
                      {pChar && (
                        <span className="step-player-role">{pChar.name}</span>
                      )}
                      {!p.is_alive && (
                        <span className="step-player-dead">†</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Demon bluffs */}
          {currentStep.isDemonInfo && (
            <div className="step-bluff-section">
              <p className="step-select-hint">
                Select 3 bluff roles to show the Demon
                {localBluffs.length > 0 ? ` · ${localBluffs.length} / 3 selected` : ''}
              </p>
              <div className="step-player-grid">
                {bluffPool.map((c) => {
                  const sel = localBluffs.includes(c.id);
                  const full = !sel && localBluffs.length >= 3;
                  return (
                    <button
                      key={c.id}
                      className={[
                        'step-player-btn',
                        sel  && 'is-selected',
                        full && 'is-dimmed',
                      ].filter(Boolean).join(' ')}
                      onClick={() =>
                        setLocalBluffs((prev) =>
                          prev.includes(c.id)
                            ? prev.filter((id) => id !== c.id)
                            : prev.length < 3
                            ? [...prev, c.id]
                            : prev
                        )
                      }
                    >
                      <span className="step-player-name">{c.name}</span>
                      <span className={`step-player-role team-color-${c.team}`}>{c.team}</span>
                    </button>
                  );
                })}
              </div>
              <button
                className="btn btn-primary reveal-show-btn"
                disabled={localBluffs.length < 3}
                onClick={() => setShowReveal(true)}
              >
                {localBluffs.length < 3
                  ? `Select ${3 - localBluffs.length} more role${3 - localBluffs.length !== 1 ? 's' : ''}`
                  : 'Show Demon →'}
              </button>
            </div>
          )}

          {/* Role reveal (Washerwoman / Librarian / Investigator) */}
          {currentStep.roleRevealTeam && roleRevealPool.length > 0 && (
            <div className="step-role-reveal-section">
              <p className="step-select-hint">
                Which {currentStep.roleRevealTeam} role token are you showing?
              </p>
              <div className="step-role-reveal-grid">
                {roleRevealPool.map((c) => {
                  const sel = localRoleId === c.id;
                  return (
                    <button
                      key={c.id}
                      className={['step-role-chip', sel && 'is-selected'].filter(Boolean).join(' ')}
                      onClick={() => setLocalRoleId(sel ? '' : c.id)}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              {localRoleId && (
                <button
                  className="btn btn-primary reveal-show-btn"
                  onClick={() => setShowReveal(true)}
                >
                  Show {charPlayer?.display_name ?? 'Player'} →
                </button>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="step-notes-section">
            <label className="step-notes-label" htmlFor="night-notes">
              Notes (optional)
            </label>
            <textarea
              id="night-notes"
              className="night-notes-input"
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              placeholder="e.g. Protected Alice because demon probably targets her"
              rows={2}
            />
          </div>
        </div>
      </main>

      {/* ── Reveal overlay ── */}
      {showReveal && (() => {
        const revealRoleDef = localRoleId ? TROUBLE_BREWING.find((c) => c.id === localRoleId) : null;
        const revealPlayers = localTargets.map((id) => players.find((p) => p.id === id)).filter(Boolean) as typeof players;
        return (
          <div className="reveal-overlay" onClick={() => setShowReveal(false)}>
            <div className="reveal-content" onClick={(e) => e.stopPropagation()}>

              {/* Demon bluffs reveal */}
              {currentStep.isDemonInfo && (
                <>
                  <p className="reveal-eyebrow">Your bluff roles</p>
                  <h2 className="reveal-title">These roles are not in play</h2>
                  <p className="reveal-sub">You may safely claim to be any of these characters.</p>
                  <div className="reveal-role-list">
                    {localBluffs.map((id) => {
                      const def = TROUBLE_BREWING.find((c) => c.id === id);
                      if (!def) return null;
                      return (
                        <div key={id} className={`reveal-role-card reveal-role-card--${def.team}`}>
                          <span className="reveal-role-name">{def.name}</span>
                          <span className="reveal-role-team">{TEAM_LABELS[def.team]}</span>
                          <p className="reveal-role-ability">{def.ability}</p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Washerwoman / Librarian / Investigator reveal */}
              {currentStep.roleRevealTeam && revealRoleDef && (
                <>
                  <p className="reveal-eyebrow">Your information</p>
                  <h2 className="reveal-title">
                    One of these players is the {revealRoleDef.name}
                  </h2>
                  <div className="reveal-players">
                    {revealPlayers.map((p) => (
                      <div key={p.id} className="reveal-player-chip">{p.display_name}</div>
                    ))}
                  </div>
                  <div className={`reveal-role-card reveal-role-card--${revealRoleDef.team} reveal-role-card--solo`}>
                    <span className="reveal-role-name">{revealRoleDef.name}</span>
                    <span className="reveal-role-team">{TEAM_LABELS[revealRoleDef.team]}</span>
                    <p className="reveal-role-ability">{revealRoleDef.ability}</p>
                  </div>
                </>
              )}

              <button className="reveal-dismiss" onClick={() => setShowReveal(false)}>
                Tap to dismiss
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Navigation ── */}
      <nav className="night-nav">
        <button
          className="night-nav-btn night-nav-btn--prev"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          ← Prev
        </button>
        <button
          className="night-nav-btn night-nav-btn--skip"
          onClick={handleSkip}
          disabled={saving}
        >
          Skip
        </button>
        <button
          className="night-nav-btn night-nav-btn--done"
          onClick={handleDone}
          disabled={saving}
        >
          {doneLabel}
        </button>
      </nav>
    </div>
  );
}
