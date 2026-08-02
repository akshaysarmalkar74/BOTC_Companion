import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadSession } from '../lib/roomUtils';
import { RoleRevealCard } from '../components/RoleRevealCard';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import type { Player, Room, Team } from '../types';

const TEAM_LABELS: Record<Team, string> = {
  townsfolk: 'Townsfolk',
  outsider: 'Outsider',
  minion: 'Minion',
  demon: 'Demon',
};

export function GamePage() {
  const [room, setRoom] = useState<Room | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]); // host only
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const session = loadSession();

  useEffect(() => {
    if (!session) navigate('/');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null;

  const { playerId, roomId, isHost } = session;

  // ── Load data ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      // Load room for code + status check
      const { data: roomData } = await supabase
        .from('rooms')
        .select('id, code, status, script, host_id, created_at')
        .eq('id', roomId)
        .single();

      if (!roomData || roomData.status !== 'in_progress') {
        navigate('/lobby');
        return;
      }
      setRoom(roomData as Room);

      if (isHost) {
        // Host: load all players with their roles
        const { data: players } = await supabase
          .from('players')
          .select('id, display_name, seat_order, is_host, role, room_id, created_at')
          .eq('room_id', roomId)
          .eq('is_host', false)
          .order('seat_order');

        setAllPlayers((players ?? []) as Player[]);
      } else {
        // Player: only fetch their own role — no other player's data is read
        const { data: me } = await supabase
          .from('players')
          .select('role')
          .eq('id', playerId)
          .single();

        setMyRole(me?.role ?? null);
      }

      setLoading(false);
    }

    load();
  }, [roomId, playerId, isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page centered">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  // ── Host view ──────────────────────────────────────────────────────
  if (isHost) {
    return (
      <div className="page game-page">
        <div className="game-container">
          <header className="game-header">
            <div className="room-code-group">
              <span className="room-code-label">Room</span>
              <span className="room-code-value">{room?.code}</span>
            </div>
            <span className="game-status-badge">Game in Progress</span>
          </header>

          <h2 className="game-section-title">Player Roles</h2>

          <div className="game-roles-table-wrapper">
            <table className="game-roles-table">
              <thead>
                <tr>
                  <th>Seat</th>
                  <th>Player</th>
                  <th>Role</th>
                  <th>Team</th>
                </tr>
              </thead>
              <tbody>
                {allPlayers.map((player, idx) => {
                  const char = player.role
                    ? TROUBLE_BREWING.find((c) => c.id === player.role)
                    : null;
                  return (
                    <tr key={player.id}>
                      <td className="col-seat">{idx + 1}</td>
                      <td className="col-player">{player.display_name}</td>
                      <td className="col-role">
                        {char ? (
                          <span className="game-role-name">{char.name}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="col-team">
                        {char && (
                          <span
                            className={`card-team-badge team-badge-${char.team}`}
                          >
                            {TEAM_LABELS[char.team]}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Player view ────────────────────────────────────────────────────

  const myCharacter = myRole
    ? TROUBLE_BREWING.find((c) => c.id === myRole) ?? null
    : null;

  if (revealed && myCharacter) {
    return (
      <div className="page centered reveal-page">
        <RoleRevealCard
          character={myCharacter}
          onHide={() => setRevealed(false)}
        />
      </div>
    );
  }

  return (
    <div className="page centered">
      <div className="form-card player-game-card">
        <p className="player-game-label">Game has started</p>
        <h2 className="player-game-title">Your role has been assigned.</h2>
        <p className="player-game-hint">
          Tap the button below to see your character. Keep your screen private.
        </p>
        <button
          className="btn btn-primary player-reveal-btn"
          onClick={() => setRevealed(true)}
          disabled={!myCharacter}
        >
          Reveal My Role
        </button>
        {!myCharacter && (
          <p className="form-error" style={{ marginTop: '12px' }}>
            Role not found. Ask the Storyteller to check the assignment.
          </p>
        )}
      </div>
    </div>
  );
}
