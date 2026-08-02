import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { supabase } from '../lib/supabase';
import { loadSession, clearSession } from '../lib/roomUtils';
import { SortablePlayerItem } from '../components/SortablePlayerItem';
import type { Player, Room } from '../types';

export function LobbyPage() {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [kicked, setKicked] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const session = loadSession();

  useEffect(() => {
    if (!session) navigate('/');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null;

  const { playerId, roomId, isHost } = session;

  // Load initial room and player data
  useEffect(() => {
    async function load() {
      const [{ data: roomData }, { data: playerData }] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).single(),
        supabase.from('players').select('*').eq('room_id', roomId).order('seat_order'),
      ]);

      if (roomData) setRoom(roomData as Room);
      if (playerData) setPlayers(playerData as Player[]);
      setLoading(false);
    }

    load();
  }, [roomId]);

  // Set up realtime subscription and presence
  useEffect(() => {
    const channel = supabase.channel(`lobby:${roomId}`, {
      config: { presence: { key: playerId } },
    });

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setPlayers((prev) => {
            if (prev.find((p) => p.id === (payload.new as Player).id)) return prev;
            return [...prev, payload.new as Player].sort((a, b) => a.seat_order - b.seat_order);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setPlayers((prev) =>
            prev
              .map((p) => (p.id === (payload.new as Player).id ? (payload.new as Player) : p))
              .sort((a, b) => a.seat_order - b.seat_order)
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
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
        const state = channel.presenceState();
        // Each key is a player ID (set via presence config above)
        setOnlineIds(new Set(Object.keys(state)));
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

  const handleRemovePlayer = async (targetId: string) => {
    await supabase.from('players').delete().eq('id', targetId);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = players.findIndex((p) => p.id === active.id);
    const newIndex = players.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(players, oldIndex, newIndex);

    // Optimistic update
    setPlayers(reordered);

    // Persist new seat_order for all affected players
    await Promise.all(
      reordered.map((player, index) =>
        supabase.from('players').update({ seat_order: index }).eq('id', player.id)
      )
    );
  };

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
    <div className="page">
      <div className="lobby-container">
        <div className="lobby-header">
          <div>
            <h2 className="lobby-title">
              {isHost ? 'Storyteller Lobby' : 'Lobby'}
            </h2>
            <div className="room-code-display">
              <span className="room-code-label">Room Code</span>
              <span className="room-code-value">{room?.code}</span>
            </div>
          </div>
          {isHost && <span className="host-badge">Storyteller</span>}
        </div>

        <div className="lobby-section">
          <div className="section-title">
            Players ({players.length})
            {isHost && <span className="section-hint">Drag to reorder seating</span>}
          </div>

          {isHost ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={players.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="player-list">
                  {players.map((player) => (
                    <SortablePlayerItem
                      key={player.id}
                      player={player}
                      isOnline={onlineIds.has(player.id)}
                      isMe={player.id === playerId}
                      onRemove={handleRemovePlayer}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="player-list">
              {players.map((player) => (
                <div key={player.id} className="player-item">
                  <div
                    className={`player-presence ${onlineIds.has(player.id) ? 'online' : 'offline'}`}
                    title={onlineIds.has(player.id) ? 'Online' : 'Offline'}
                  />
                  <span className="player-name">{player.display_name}</span>
                  {player.is_host && <span className="player-badge host">Storyteller</span>}
                  {player.id === playerId && !player.is_host && (
                    <span className="player-badge me">You</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
