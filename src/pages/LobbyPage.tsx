import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadSession, clearSession } from '../lib/roomUtils';
import { CircularSeating } from '../components/CircularSeating';
import type { Player, Room } from '../types';

export function LobbyPage() {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [scriptCount, setScriptCount] = useState<number | null>(null);
  const [kicked, setKicked] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const session = loadSession();

  useEffect(() => {
    if (!session) navigate('/');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null;

  const { playerId, roomId, isHost } = session;

  // ── Initial data load ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [{ data: roomData }, { data: playerData }] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).single(),
        // role is intentionally excluded — players must not see each other's roles
        supabase
          .from('players')
          .select('id, room_id, display_name, is_host, is_bot, seat_order, created_at')
          .eq('room_id', roomId)
          .order('seat_order'),
      ]);

      if (roomData) {
        const r = roomData as Room;
        setRoom(r);
        setScriptCount(Array.isArray(r.script) ? r.script.length : 0);
        if (r.status === 'in_progress') {
          navigate('/game');
          return;
        }
      }
      if (playerData) setPlayers(playerData as Player[]);
      setLoading(false);
    }

    load();
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime subscription + presence ──────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`lobby:${roomId}`, {
      config: { presence: { key: playerId } },
    });

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setPlayers((prev) => {
            if (prev.find((p) => p.id === (payload.new as Player).id)) return prev;
            return [...prev, payload.new as Player].sort(
              (a, b) => a.seat_order - b.seat_order
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as Player;
          // Only update lobby-visible fields — never expose role to other players
          setPlayers((prev) =>
            prev
              .map((p) =>
                p.id === updated.id
                  ? {
                      ...p,
                      display_name: updated.display_name,
                      is_host: updated.is_host,
                      seat_order: updated.seat_order,
                    }
                  : p
              )
              .sort((a, b) => a.seat_order - b.seat_order)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as Room;
          setRoom(updated);
          setScriptCount(Array.isArray(updated.script) ? updated.script.length : 0);
          if (updated.status === 'in_progress') {
            navigate('/game');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          if (deletedId === playerId) {
            clearSession();
            setKicked(true);
          } else {
            setPlayers((prev) => prev.filter((p) => p.id !== deletedId));
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        // Presence key = playerId, so Object.keys gives all online player IDs
        setOnlineIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ player_id: playerId });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, playerId]);

  // ── Host actions ───────────────────────────────────────────────────

  const handleSwap = async (idA: string, idB: string) => {
    const playerA = players.find((p) => p.id === idA);
    const playerB = players.find((p) => p.id === idB);
    if (!playerA || !playerB) return;

    const orderA = playerA.seat_order;
    const orderB = playerB.seat_order;

    // Optimistic update — swap their seat_order values
    setPlayers((prev) =>
      prev
        .map((p) => {
          if (p.id === idA) return { ...p, seat_order: orderB };
          if (p.id === idB) return { ...p, seat_order: orderA };
          return p;
        })
        .sort((a, b) => a.seat_order - b.seat_order)
    );

    // Persist both changes in parallel
    await Promise.all([
      supabase.from('players').update({ seat_order: orderB }).eq('id', idA),
      supabase.from('players').update({ seat_order: orderA }).eq('id', idB),
    ]);
  };

  const handleRemovePlayer = async (targetId: string) => {
    await supabase.from('players').delete().eq('id', targetId);
  };

  const BOT_NAMES = [
    'Aldric', 'Brynn', 'Cassia', 'Dorian', 'Elara',
    'Fenn', 'Greta', 'Hadley', 'Isolde', 'Jareth',
    'Kira', 'Lorne', 'Mira', 'Nils', 'Orin',
    'Petra', 'Quinn', 'Rook', 'Silas', 'Tova',
  ];

  const handleAddBot = async () => {
    const existingBots = players.filter((p) => p.is_bot);
    const usedNames = new Set(existingBots.map((p) => p.display_name));
    const availableName = BOT_NAMES.find((n) => !usedNames.has(n)) ??
      `Bot ${existingBots.length + 1}`;

    const maxSeat = players.reduce((m, p) => Math.max(m, p.seat_order), 0);

    await supabase.from('players').insert({
      room_id: roomId,
      display_name: availableName,
      is_host: false,
      is_bot: true,
      seat_order: maxSeat + 1,
    });
  };

  // ── Render ─────────────────────────────────────────────────────────

  if (kicked) {
    return (
      <div className="page centered">
        <div className="form-card">
          <h2 className="form-title">Removed from Room</h2>
          <p className="text-muted" style={{ marginBottom: '24px' }}>
            You have been removed from the room by the Storyteller.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page centered">
        <p className="text-muted">Loading lobby…</p>
      </div>
    );
  }

  return (
    <div className="lobby-page">
      {/* ── Header ── */}
      <header className="lobby-header">
        <div className="room-code-group">
          <span className="room-code-label">Room</span>
          <span className="room-code-value">{room?.code}</span>
        </div>
        <div className="lobby-header-right">
          <span className="lobby-player-count">
            {players.filter((p) => !p.is_host).length} player{players.filter((p) => !p.is_host).length !== 1 ? 's' : ''}
          </span>
          {isHost && <span className="host-badge">Storyteller</span>}
        </div>
      </header>

      {/* ── Nav bar ── */}
      <nav className="lobby-nav">
        <button
          className="lobby-nav-btn"
          onClick={() => navigate('/characters')}
        >
          Character Reference
        </button>
        {isHost && (
          <>
            <button
              className="lobby-nav-btn lobby-nav-btn--accent"
              onClick={() => navigate('/script')}
            >
              {scriptCount === null || scriptCount === 0
                ? 'Build Script'
                : `Script · ${scriptCount} characters`}
            </button>
            <button
              className="lobby-nav-btn lobby-nav-btn--primary"
              onClick={() => navigate('/assign')}
              disabled={!scriptCount}
              title={!scriptCount ? 'Build a script first' : undefined}
            >
              Assign Roles
            </button>
            <button
              className="lobby-nav-btn lobby-nav-btn--bot"
              onClick={handleAddBot}
            >
              + Add Bot
            </button>
          </>
        )}
      </nav>

      {/* ── Circular seating ── */}
      <div className="lobby-circle-area">
        {players.filter((p) => !p.is_host).length === 0 ? (
          <p className="text-muted">Waiting for players to join…</p>
        ) : (
          <CircularSeating
            players={players}
            onlineIds={onlineIds}
            myPlayerId={playerId}
            isHost={isHost}
            onSwap={handleSwap}
            onRemove={handleRemovePlayer}
          />
        )}
      </div>
    </div>
  );
}
