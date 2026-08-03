import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadSession } from '../lib/roomUtils';
import { recordNomination, recordExecution, recordDayNote } from '../lib/gameHistory';
import { PlayerDetailPanel } from '../components/PlayerDetailPanel';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
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
    setPlayers((prev) => prev.map((p) => p.id === executeId ? { ...p, is_alive: false } : p));
    void recordExecution(room.id, room.phase, executeId, players);
    setExecuteId('');
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
                {players.map((p) => (
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
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}{!p.is_alive ? ' (dead)' : ''}
                  </option>
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

      {/* ── Player detail panel ── */}
      {selectedPlayer && (
        <PlayerDetailPanel
          player={selectedPlayer}
          character={selectedCharacter}
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
