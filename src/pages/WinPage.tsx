import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadSession, clearSession } from '../lib/roomUtils';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import type { Player, Room } from '../types';

const TEAM_LABELS: Record<string, string> = {
  townsfolk: 'Townsfolk',
  outsider:  'Outsider',
  minion:    'Minion',
  demon:     'Demon',
};

export function WinPage() {
  const [room, setRoom]             = useState<Room | null>(null);
  const [players, setPlayers]       = useState<Player[]>([]);
  const [loading, setLoading]       = useState(true);
  const [rematching, setRematching] = useState(false);
  const navigate = useNavigate();

  const session = loadSession();
  const isHost = session?.isHost ?? false;
  const roomId = session?.roomId ?? '';

  useEffect(() => {
    if (!session) { navigate('/'); return; }

    async function load() {
      const [{ data: roomData }, { data: playerData }] = await Promise.all([
        supabase
          .from('rooms')
          .select('id, code, status, script, host_id, phase, night_step_key, outcome, ended_at, created_at')
          .eq('id', session!.roomId)
          .single(),
        supabase
          .from('players')
          .select('id, display_name, seat_order, is_host, role, drunk_role, is_alive, ghost_vote_used, notes, room_id, created_at')
          .eq('room_id', session!.roomId)
          .eq('is_host', false)
          .order('seat_order'),
      ]);

      if (!roomData || roomData.status !== 'completed') {
        navigate(session!.isHost ? '/game' : '/');
        return;
      }

      setRoom(roomData as Room);
      setPlayers((playerData ?? []) as Player[]);
      setLoading(false);
    }

    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="page centered">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (!room) return null;

  const outcome = room.outcome;
  const isGood      = outcome === 'good';
  const isEvil      = outcome === 'evil';
  const isCancelled = outcome === 'cancelled';

  const outcomeLabel = isGood ? 'Good Wins!' : isEvil ? 'Evil Wins!' : 'Game Cancelled';
  const outcomeClass = isGood ? 'win--good' : isEvil ? 'win--evil' : 'win--cancelled';

  // Find the demon player (for the dramatic reveal)
  const demonPlayer = players.find((p) => {
    const char = p.role ? TROUBLE_BREWING.find((c) => c.id === p.role) : null;
    return char?.team === 'demon';
  });
  const demonChar = demonPlayer?.role
    ? TROUBLE_BREWING.find((c) => c.id === demonPlayer.role) ?? null
    : null;

  // Sort: demon first, then minions, then outsiders, then townsfolk
  const teamOrder: Record<string, number> = { demon: 0, minion: 1, outsider: 2, townsfolk: 3 };
  const sorted = [...players].sort((a, b) => {
    const aTeam = TROUBLE_BREWING.find((c) => c.id === a.role)?.team ?? 'townsfolk';
    const bTeam = TROUBLE_BREWING.find((c) => c.id === b.role)?.team ?? 'townsfolk';
    return (teamOrder[aTeam] ?? 9) - (teamOrder[bTeam] ?? 9);
  });

  const handleRematch = async () => {
    if (!room || !isHost) return;
    setRematching(true);
    await Promise.all([
      supabase.from('night_actions').delete().eq('room_id', roomId),
      supabase.from('day_events').delete().eq('room_id', roomId),
      supabase.from('day_notes').delete().eq('room_id', roomId),
      supabase.from('reminder_tokens').delete().eq('room_id', roomId),
      supabase.from('game_events').delete().eq('room_id', roomId),
    ]);
    await supabase
      .from('players')
      .update({ role: null, drunk_role: null, is_alive: true, ghost_vote_used: false, notes: '' })
      .eq('room_id', roomId)
      .eq('is_host', false);
    await supabase
      .from('rooms')
      .update({ status: 'lobby', phase: 'Night 1', outcome: null, ended_at: null, night_step_key: null })
      .eq('id', roomId);
    setRematching(false);
    navigate('/assign');
  };

  const handleNewGame = () => {
    clearSession();
    navigate('/');
  };

  return (
    <div className={`win-page ${outcomeClass}`}>
      {/* ── Outcome banner ── */}
      <div className="win-banner">
        <p className="win-eyebrow">Game Over · Room {room.code}</p>
        <h1 className="win-title">{outcomeLabel}</h1>
        {demonPlayer && demonChar && !isCancelled && (
          <p className="win-demon-reveal">
            The Demon was{' '}
            <strong>{demonPlayer.display_name}</strong>
            {' '}— {demonChar.name}
          </p>
        )}
      </div>

      {/* ── Player roster ── */}
      <div className="win-content">
        <h2 className="win-roster-title">All Roles Revealed</h2>
        <div className="win-player-grid">
          {sorted.map((p) => {
            const char = p.role ? TROUBLE_BREWING.find((c) => c.id === p.role) ?? null : null;
            // Drunk shows their real role in the reveal
            const isDrunk = p.role === 'drunk';
            const drunkChar = isDrunk && p.drunk_role
              ? TROUBLE_BREWING.find((c) => c.id === p.drunk_role) ?? null
              : null;

            return (
              <div
                key={p.id}
                className={[
                  'win-player-card',
                  char ? `win-player-card--${char.team}` : '',
                  !p.is_alive ? 'win-player-card--dead' : '',
                ].filter(Boolean).join(' ')}
              >
                <div className="win-player-header">
                  <span className="win-player-name">{p.display_name}</span>
                  {!p.is_alive && <span className="win-player-dead">†</span>}
                </div>
                {char && (
                  <span className={`win-player-team team-badge-${char.team}`}>
                    {TEAM_LABELS[char.team]}
                  </span>
                )}
                <span className="win-player-role">{char?.name ?? '—'}</span>
                {isDrunk && drunkChar && (
                  <span className="win-player-drunk">thought they were {drunkChar.name}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="win-actions">
        <button
          className="btn btn-secondary win-action-btn"
          onClick={() => navigate('/history')}
        >
          View History
        </button>
        {isHost ? (
          <button
            className="btn btn-primary win-action-btn"
            onClick={handleRematch}
            disabled={rematching}
          >
            {rematching ? 'Setting up…' : 'Rematch'}
          </button>
        ) : null}
        <button
          className="btn btn-secondary win-action-btn"
          onClick={handleNewGame}
        >
          New Game
        </button>
      </div>
    </div>
  );
}
