import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadSession } from '../lib/roomUtils';
import { recordNomination, recordExecution, recordDayNote, recordEvent } from '../lib/gameHistory';
import { PlayerDetailPanel } from '../components/PlayerDetailPanel';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import { checkVirgin, checkSaint, checkSlayer, checkMayor } from '../engine/dayEngine';
import type { DayAbilityResult } from '../engine/dayEngine';
import type { GameState } from '../engine/types';
import { detectWinCondition, detectSaintExecution, detectScarletWomanPromotion, type WinDetection, type DemonPromotion } from '../lib/winConditions';
import type { Player, Room, ReminderToken, DayEvent, DayNote } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build the game timeline from the current phase string. */
function buildTimeline(phase: string): { label: string; status: 'done' | 'current' }[] {
  const m = phase.match(/^(Night|Day) (\d+)$/);
  if (!m) return [];
  const type = m[1];
  const n = parseInt(m[2]);
  const items: { label: string; status: 'done' | 'current' }[] = [];
  for (let i = 1; i <= n; i++) {
    if (i < n) {
      items.push({ label: `Night ${i}`, status: 'done' });
      items.push({ label: `Day ${i}`,   status: 'done' });
    } else {
      if (type === 'Night') {
        items.push({ label: `Night ${n}`, status: 'current' });
      } else {
        items.push({ label: `Night ${n}`, status: 'done' });
        items.push({ label: `Day ${n}`,   status: 'current' });
      }
    }
  }
  return items;
}

function renderEventText(event: DayEvent, players: Player[]): string {
  if (event.event_type === 'nomination') {
    const nom  = players.find((p) => p.id === event.payload.nominator_id);
    const nomy = players.find((p) => p.id === event.payload.nominee_id);
    return `${nom?.display_name ?? '?'} nominated ${nomy?.display_name ?? '?'}`;
  }
  if (event.event_type === 'execution') {
    const p = players.find((p) => p.id === event.payload.player_id);
    return `${p?.display_name ?? '?'} was executed`;
  }
  return '';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DayAssistantPage() {
  const [room, setRoom]                     = useState<Room | null>(null);
  const [players, setPlayers]               = useState<Player[]>([]);
  const [reminderTokens, setReminderTokens] = useState<ReminderToken[]>([]);
  const [allDayEvents, setAllDayEvents]     = useState<DayEvent[]>([]);
  const [dayNote, setDayNote]               = useState('');
  const [notesFocused, setNotesFocused]     = useState(false);
  const [nominatorId, setNominatorId]       = useState('');
  const [nomineeId, setNomineeId]           = useState('');
  const [executeId, setExecuteId]           = useState('');
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [showHistory, setShowHistory]       = useState(false);
  const [loading, setLoading]               = useState(true);
  const [dayAbilityBanners, setDayAbilityBanners] = useState<DayAbilityResult[]>([]);
  const [slayerPlayerId, setSlayerPlayerId] = useState('');
  const [slayerTargetId, setSlayerTargetId] = useState('');
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

  // ── Load ──────────────────────────────────────────────────────────────────
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

      // Derive the day number we're managing
      const phaseMatch = r.phase.match(/^(Night|Day) (\d+)$/);
      const phaseType  = phaseMatch?.[1] ?? 'Night';
      const phaseNum   = parseInt(phaseMatch?.[2] ?? '1');
      const dayNum     = phaseType === 'Day' ? phaseNum : phaseNum - 1;

      const [{ data: playerData }, { data: tokenData }, { data: eventData }, { data: noteData }] =
        await Promise.all([
          supabase
            .from('players')
            .select(
              'id, display_name, seat_order, is_host, role, is_alive, ghost_vote_used, notes, room_id, created_at'
            )
            .eq('room_id', roomId)
            .eq('is_host', false)
            .order('seat_order'),
          supabase.from('reminder_tokens').select('*').eq('room_id', roomId),
          supabase.from('day_events').select('*').eq('room_id', roomId).order('created_at'),
          dayNum > 0
            ? supabase
                .from('day_notes')
                .select('*')
                .eq('room_id', roomId)
                .eq('day_number', dayNum)
                .single()
            : Promise.resolve({ data: null }),
        ]);

      setPlayers((playerData  ?? []) as Player[]);
      setReminderTokens((tokenData ?? []) as ReminderToken[]);
      setAllDayEvents((eventData ?? []) as DayEvent[]);
      setDayNote((noteData as DayNote | null)?.notes ?? '');
      setLoading(false);
    }
    load();
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`day:${roomId}`);
    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'day_events', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const e = payload.new as DayEvent;
          setAllDayEvents((prev) => (prev.find((x) => x.id === e.id) ? prev : [...prev, e]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const u = payload.new as Player;
          setPlayers((prev) =>
            prev.map((p) =>
              p.id === u.id
                ? { ...p, is_alive: u.is_alive, ghost_vote_used: u.ghost_vote_used, notes: u.notes, display_name: u.display_name }
                : p
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'day_notes', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const n = payload.new as DayNote;
          if (!notesFocused) setDayNote(n.notes);
        }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [roomId, notesFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ───────────────────────────────────────────────────────────────
  if (!room) return null;

  const phaseMatch = room.phase.match(/^(Night|Day) (\d+)$/);
  const phaseType  = phaseMatch?.[1] ?? 'Night';
  const phaseNum   = parseInt(phaseMatch?.[2] ?? '1');
  const isDayPhase = phaseType === 'Day';
  const dayNumber  = isDayPhase ? phaseNum : phaseNum - 1;

  const timeline    = buildTimeline(room.phase);
  const aliveCount  = players.filter((p) => p.is_alive).length;
  const todayEvents = allDayEvents.filter((e) => e.day_number === dayNumber);

  // Group all events by day for history
  const maxDay = allDayEvents.reduce((m, e) => Math.max(m, e.day_number), 0);
  const historyDays: { day: number; events: DayEvent[] }[] = [];
  for (let d = 1; d <= maxDay; d++) {
    const events = allDayEvents.filter((e) => e.day_number === d);
    if (events.length > 0) historyDays.push({ day: d, events });
  }

  const selectedPlayer    = selectedId ? players.find((p) => p.id === selectedId) ?? null : null;
  const selectedCharacter = selectedPlayer?.role
    ? TROUBLE_BREWING.find((c) => c.id === selectedPlayer.role) ?? null : null;
  const selectedTokens    = selectedId
    ? reminderTokens.filter((t) => t.player_id === selectedId) : [];

  // ── Day engine helpers ────────────────────────────────────────────────────

  function buildGameState(currentPlayers: Player[], currentTokens: ReminderToken[]): GameState {
    return {
      roomId,
      players: currentPlayers,
      reminderTokens: currentTokens,
      nightNumber: dayNumber, // approximate; day engine doesn't need exact night number
      script: Array.isArray(room?.script) ? (room!.script as string[]) : [],
    };
  }

  function addBanner(result: DayAbilityResult) {
    setDayAbilityBanners((prev) => [...prev, result]);
  }

  function dismissBanner(index: number) {
    setDayAbilityBanners((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleRecordNomination = async () => {
    if (!nominatorId || !nomineeId || !room) return;
    const { data } = await supabase
      .from('day_events')
      .insert({
        room_id: room.id,
        day_number: dayNumber,
        event_type: 'nomination',
        payload: { nominator_id: nominatorId, nominee_id: nomineeId },
      })
      .select()
      .single();
    if (data) setAllDayEvents((prev) => [...prev, data as DayEvent]);
    void recordNomination(room.id, room.phase, nominatorId, nomineeId, players);

    // Check Virgin ability
    const gs = buildGameState(players, reminderTokens);
    const virginResult = checkVirgin(gs, nomineeId, nominatorId);
    if (virginResult) {
      addBanner(virginResult);
      void recordEvent({
        roomId: room.id, phase: room.phase,
        type: 'player_death',
        description: virginResult.message,
        playerIds: virginResult.affectedPlayerIds,
        metadata: { abilityType: virginResult.type },
      });
      // Mark once-per-game: place token so subsequent nominations don't re-trigger
      if (virginResult.type === 'virgin-trigger') {
        const virgin = players.find((p) => p.id === nomineeId);
        if (virgin) {
          const { data: newToken } = await supabase
            .from('reminder_tokens')
            .insert({ player_id: virgin.id, room_id: room.id, token_key: 'virgin-ability-used' })
            .select('id, player_id, room_id, token_key, created_at')
            .single();
          if (newToken) setReminderTokens((prev) => [...prev, newToken as import('../types').ReminderToken]);
        }
      }
    }

    setNominatorId('');
    setNomineeId('');
  };

  const handleExecute = async () => {
    if (!executeId || !room) return;
    const [{ data: eventData }] = await Promise.all([
      supabase
        .from('day_events')
        .insert({
          room_id: room.id,
          day_number: dayNumber,
          event_type: 'execution',
          payload: { player_id: executeId },
        })
        .select()
        .single(),
      supabase.from('players').update({ is_alive: false }).eq('id', executeId),
    ]);
    if (eventData) setAllDayEvents((prev) => [...prev, eventData as DayEvent]);
    const updatedPlayers = players.map((p) => p.id === executeId ? { ...p, is_alive: false } : p);
    setPlayers(updatedPlayers);
    void recordExecution(room.id, room.phase, executeId, players);

    // Check Saint ability (dayEngine)
    const gs = buildGameState(updatedPlayers, reminderTokens);
    const saintResult = checkSaint(gs, executeId);
    if (saintResult) {
      addBanner(saintResult);
      void recordEvent({
        roomId: room.id, phase: room.phase,
        type: 'game_end',
        description: saintResult.message,
        playerIds: saintResult.affectedPlayerIds,
        metadata: { abilityType: saintResult.type, outcome: 'evil' },
      });
    }

    // Saint execution → immediate Evil win (overrides SW promotion)
    const saintWin = detectSaintExecution(players, executeId);
    if (saintWin) {
      setWinAlert(saintWin);
    } else {
      // Check SW succession before declaring Good wins
      const promotion = detectScarletWomanPromotion(updatedPlayers);
      if (promotion) {
        setDemonPromotion(promotion);
      } else {
        const autoWin = detectWinCondition(updatedPlayers);
        if (autoWin) setWinAlert(autoWin);
      }
    }

    setExecuteId('');
  };

  const handleSlayer = async () => {
    if (!slayerPlayerId || !slayerTargetId || !room) return;
    const gs = buildGameState(players, reminderTokens);
    const result = checkSlayer(gs, slayerPlayerId, slayerTargetId);
    if (!result) return;

    addBanner(result);

    // Place the slayer-used token to mark once-per-game
    if (result.type !== 'slayer-already-used') {
      await supabase.from('reminder_tokens').insert({
        player_id: slayerPlayerId,
        room_id: room.id,
        token_key: 'slayer-used',
      });
    }

    // If hit, kill the Demon
    if (result.type === 'slayer-hit') {
      await supabase.from('players').update({ is_alive: false }).eq('id', slayerTargetId);
      const updatedPlayers = players.map((p) => p.id === slayerTargetId ? { ...p, is_alive: false } : p);
      setPlayers(updatedPlayers);
      // Check SW succession before declaring Good wins
      const promotion = detectScarletWomanPromotion(updatedPlayers);
      if (promotion) {
        setDemonPromotion(promotion);
      } else {
        const win = detectWinCondition(updatedPlayers);
        if (win) setWinAlert(win);
      }
    }

    void recordEvent({
      roomId: room.id, phase: room.phase,
      type: result.type === 'slayer-hit' ? 'player_death' : 'resolution_advisory',
      description: result.message,
      playerIds: result.affectedPlayerIds,
      metadata: { abilityType: result.type },
    });

    setSlayerPlayerId('');
    setSlayerTargetId('');
  };

  const handleCheckMayor = () => {
    if (!room) return;
    const phaseMatch2 = room.phase.match(/^(Night|Day) (\d+)$/);
    const isDayPhase2 = phaseMatch2?.[1] === 'Day';
    const dayNum2 = isDayPhase2 ? parseInt(phaseMatch2![2]) : parseInt(phaseMatch2?.[2] ?? '1') - 1;
    const executionOccurred = allDayEvents.some((e) => e.day_number === dayNum2 && e.event_type === 'execution');
    const gs = buildGameState(players, reminderTokens);
    const result = checkMayor(gs, executionOccurred);
    if (result) {
      addBanner(result);
      void recordEvent({
        roomId: room.id, phase: room.phase,
        type: 'game_end',
        description: result.message,
        playerIds: result.affectedPlayerIds,
        metadata: { abilityType: result.type, outcome: 'good' },
      });
    } else {
      addBanner({
        type: 'mayor-win',
        message: 'Mayor win condition not met — either fewer/more than 3 players alive, an execution occurred, or Mayor is absent/poisoned.',
        affectedPlayerIds: [],
        isStateChange: false,
        requiresConfirmation: true,
      });
    }
  };

  const handlePromoteScarletWoman = async (swId: string) => {
    await supabase.from('players').update({ role: 'imp' }).eq('id', swId);
    setPlayers((prev) => prev.map((p) => p.id === swId ? { ...p, role: 'imp' } : p));
    setDemonPromotion(null);
  };

  const handleEndGame = async (outcome: 'good' | 'evil' | 'cancelled') => {
    if (!room) return;
    setEndingGame(true);
    const endedAt = new Date().toISOString();
    await supabase
      .from('rooms')
      .update({ status: 'completed', outcome, ended_at: endedAt })
      .eq('id', roomId);
    setEndingGame(false);
    navigate('/win');
  };

  const handleSaveNotes = async () => {
    setNotesFocused(false);
    if (!room || dayNumber < 1) return;
    await supabase
      .from('day_notes')
      .upsert(
        { room_id: room.id, day_number: dayNumber, notes: dayNote, updated_at: new Date().toISOString() },
        { onConflict: 'room_id,day_number' }
      );
    void recordDayNote(room.id, room.phase, dayNote);
  };

  const handleToggleAlive = async (targetId: string) => {
    const p = players.find((x) => x.id === targetId);
    if (!p) return;
    const val = !p.is_alive;
    setPlayers((prev) => prev.map((x) => x.id === targetId ? { ...x, is_alive: val } : x));
    await supabase.from('players').update({ is_alive: val }).eq('id', targetId);
  };

  const handleToggleGhostVote = async (targetId: string) => {
    const p = players.find((x) => x.id === targetId);
    if (!p) return;
    const val = !p.ghost_vote_used;
    setPlayers((prev) => prev.map((x) => x.id === targetId ? { ...x, ghost_vote_used: val } : x));
    await supabase.from('players').update({ ghost_vote_used: val }).eq('id', targetId);
  };

  const handleNotesSave = async (targetId: string, notes: string) => {
    setPlayers((prev) => prev.map((x) => x.id === targetId ? { ...x, notes } : x));
    await supabase.from('players').update({ notes }).eq('id', targetId);
  };

  const handleAddToken = async (tokenKey: string) => {
    if (!selectedId || !room) return;
    const { data } = await supabase
      .from('reminder_tokens')
      .insert({ player_id: selectedId, room_id: room.id, token_key: tokenKey })
      .select('id, player_id, room_id, token_key, created_at')
      .single();
    if (data) setReminderTokens((prev) => [...prev, data as ReminderToken]);
  };

  const handleRemoveToken = async (tokenId: string) => {
    setReminderTokens((prev) => prev.filter((t) => t.id !== tokenId));
    await supabase.from('reminder_tokens').delete().eq('id', tokenId);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page centered">
        <p className="text-muted">Loading day…</p>
      </div>
    );
  }

  if (dayNumber < 1) {
    return (
      <div className="day-page">
        <header className="night-header">
          <button className="night-back-btn" onClick={() => navigate('/game')}>← Grimoire</button>
          <span className="night-header-label">{room.phase}</span>
          <span />
        </header>
        <div className="day-empty">
          <p className="text-muted">No day phase has started yet.</p>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: 8 }}>
            Complete Night 1 first, then return here to manage the day.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="day-page">
      {/* ── Header ── */}
      <header className="night-header">
        <button className="night-back-btn" onClick={() => navigate('/game')}>← Grimoire</button>
        <div className="night-header-center" style={{ cursor: 'default' }}>
          <span className="day-header-label">Day {dayNumber}</span>
          <span className="night-header-progress">{aliveCount} alive · {players.length - aliveCount} dead</span>
        </div>
        <button
          className="night-back-btn"
          style={{ textAlign: 'right' }}
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? 'Hide History' : 'History'}
        </button>
      </header>

      {/* ── Timeline ── */}
      <div className="day-timeline">
        {timeline.map((item) => (
          <span
            key={item.label}
            className={`day-timeline-item${item.status === 'current' ? ' current' : ' done'}`}
          >
            {item.label}
            {item.status === 'done' ? ' ✓' : ' ▶'}
          </span>
        ))}
      </div>

      {/* ── Day ability banners ── */}
      {dayAbilityBanners.map((banner, i) => (
        <div
          key={i}
          className={`day-ability-banner ${banner.isStateChange ? 'day-ability-banner--state-change' : 'day-ability-banner--advisory'}`}
        >
          <span className="day-ability-banner-msg">{banner.message}</span>
          <button className="day-ability-banner-dismiss" onClick={() => dismissBanner(i)}>×</button>
        </div>
      ))}

      <main className="day-content">

        {/* ── Player status ── */}
        <section className="day-section">
          <h3 className="day-section-title">Players</h3>
          <div className="day-player-grid">
            {players.map((p) => (
              <button
                key={p.id}
                className={`day-player-card${!p.is_alive ? ' is-dead' : ''}`}
                onClick={() => setSelectedId(p.id)}
              >
                <span className="day-player-name">{p.display_name}</span>
                <span className={`day-player-status${p.is_alive ? ' alive' : ' dead'}`}>
                  {p.is_alive ? 'Alive' : 'Dead'}
                </span>
                {!p.is_alive && (
                  <span className={`day-ghost-vote${p.ghost_vote_used ? ' used' : ''}`}>
                    {p.ghost_vote_used ? 'Vote used' : 'Vote available'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ── Nominations (active day only) ── */}
        {isDayPhase && (
          <section className="day-section">
            <h3 className="day-section-title">Record Nomination</h3>
            <div className="day-row">
              <select
                className="day-select"
                value={nominatorId}
                onChange={(e) => setNominatorId(e.target.value)}
              >
                <option value="">Nominator…</option>
                {players.filter((p) => p.is_alive).map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
              <span className="day-arrow">→</span>
              <select
                className="day-select"
                value={nomineeId}
                onChange={(e) => setNomineeId(e.target.value)}
              >
                <option value="">Nominee…</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
              <button
                className="btn btn-secondary day-action-btn"
                onClick={handleRecordNomination}
                disabled={!nominatorId || !nomineeId}
              >
                Record
              </button>
            </div>
          </section>
        )}

        {/* ── Execution (active day only) ── */}
        {isDayPhase && (
          <section className="day-section">
            <h3 className="day-section-title">Execute Player</h3>
            <div className="day-row">
              <select
                className="day-select"
                value={executeId}
                onChange={(e) => setExecuteId(e.target.value)}
              >
                <option value="">Select player…</option>
                {players.filter((p) => p.is_alive).map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
              <button
                className="btn day-execute-btn"
                onClick={handleExecute}
                disabled={!executeId}
              >
                Execute
              </button>
            </div>
          </section>
        )}

        {/* ── Slayer action (active day only, if Slayer in game and ability not yet used) ── */}
        {isDayPhase && players.some((p) => p.role === 'slayer' && p.is_alive) &&
         !reminderTokens.some((t) => t.token_key === 'slayer-used') && (
          <section className="day-section">
            <h3 className="day-section-title">Slayer Action</h3>
            <p className="day-section-hint">
              Slayer publicly declares a target. If the target is the Demon, they die.
              Once per game only.
            </p>
            <div className="day-row">
              <select
                className="day-select"
                value={slayerPlayerId}
                onChange={(e) => setSlayerPlayerId(e.target.value)}
              >
                <option value="">Slayer is…</option>
                {players.filter((p) => p.role === 'slayer' && p.is_alive).map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
              <span className="day-arrow">→</span>
              <select
                className="day-select"
                value={slayerTargetId}
                onChange={(e) => setSlayerTargetId(e.target.value)}
              >
                <option value="">Target…</option>
                {players.filter((p) => p.is_alive).map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
              <button
                className="btn btn-secondary day-action-btn"
                onClick={handleSlayer}
                disabled={!slayerPlayerId || !slayerTargetId}
              >
                Slay
              </button>
            </div>
          </section>
        )}

        {/* ── Mayor check (active day only) ── */}
        {isDayPhase && players.some((p) => p.role === 'mayor' && p.is_alive) && (
          <section className="day-section">
            <h3 className="day-section-title">Mayor Win Check</h3>
            <p className="day-section-hint">
              Check if Mayor win condition is met (3 alive, no execution this day).
            </p>
            <button
              className="btn btn-secondary day-action-btn"
              onClick={handleCheckMayor}
            >
              Check Mayor Condition
            </button>
          </section>
        )}

        {/* ── Today's events ── */}
        {todayEvents.length > 0 && (
          <section className="day-section">
            <h3 className="day-section-title">Day {dayNumber} Events</h3>
            <div className="day-event-list">
              {todayEvents.map((e) => (
                <div key={e.id} className={`day-event day-event--${e.event_type}`}>
                  {renderEventText(e, players)}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Day notes ── */}
        {dayNumber >= 1 && (
          <section className="day-section">
            <label className="day-section-title" htmlFor="day-notes">
              Day {dayNumber} Notes
            </label>
            <textarea
              id="day-notes"
              className="night-notes-input"
              value={dayNote}
              onChange={(e) => setDayNote(e.target.value)}
              onFocus={() => setNotesFocused(true)}
              onBlur={handleSaveNotes}
              placeholder="Chef claimed 2 · Alice suspected Bob · Suspected Poisoner bluff…"
              rows={3}
            />
          </section>
        )}

        {/* ── Game history (collapsible) ── */}
        {showHistory && (
          <section className="day-section">
            <h3 className="day-section-title">Game History</h3>
            {historyDays.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>No events recorded yet.</p>
            ) : (
              historyDays.map(({ day, events }) => (
                <div key={day} className="day-history-block">
                  <h4 className="day-history-day">Day {day}</h4>
                  {events.map((e) => (
                    <div key={e.id} className={`day-event day-event--${e.event_type}`}>
                      {renderEventText(e, players)}
                    </div>
                  ))}
                </div>
              ))
            )}
          </section>
        )}
      </main>

      {/* ── Scarlet Woman Demon Promotion ── */}
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
              The game continues. Update her token and wake her tonight as the Imp.
            </p>
            <div className="end-game-options">
              <button
                className="btn end-game-btn end-game-evil"
                onClick={() => void handlePromoteScarletWoman(demonPromotion.playerId)}
              >
                Promote {demonPromotion.playerName} → Imp
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setDemonPromotion(null)}
              >
                Handle Manually
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Win Condition Alert ── */}
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
              <button
                className="btn btn-secondary"
                onClick={() => setWinAlert(null)}
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Player detail panel ── */}
      {selectedPlayer && (
        <PlayerDetailPanel
          player={selectedPlayer}
          character={selectedCharacter}
          drunkRoleChar={null}
          playerTokens={selectedTokens}
          onClose={() => setSelectedId(null)}
          onToggleAlive={handleToggleAlive}
          onToggleGhostVote={handleToggleGhostVote}
          onNotesSave={handleNotesSave}
          onAddToken={handleAddToken}
          onRemoveToken={handleRemoveToken}
        />
      )}
    </div>
  );
}
