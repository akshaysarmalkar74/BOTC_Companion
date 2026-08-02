import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { saveSession } from '../lib/roomUtils';

export function JoinRoomPage() {
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    const code = roomCode.trim().toUpperCase();
    if (!name || !code) return;

    setLoading(true);
    setError(null);

    try {
      // Find the room by code
      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', code)
        .maybeSingle();

      if (roomErr) throw new Error(roomErr.message);
      if (!room) throw new Error('Room not found. Check the code and try again.');

      // Determine next seat order
      const { data: last } = await supabase
        .from('players')
        .select('seat_order')
        .eq('room_id', room.id)
        .order('seat_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = last ? last.seat_order + 1 : 1;

      // Create the player
      const { data: player, error: playerErr } = await supabase
        .from('players')
        .insert({
          room_id: room.id,
          display_name: name,
          is_host: false,
          seat_order: nextOrder,
        })
        .select()
        .single();

      if (playerErr || !player) throw new Error(playerErr?.message ?? 'Failed to join room');

      saveSession(player.id, room.id, false);
      navigate('/lobby');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page centered">
      <div className="form-card">
        <button className="btn-back" onClick={() => navigate('/')}>← Back</button>
        <h2 className="form-title">Join Room</h2>
        <form onSubmit={handleJoin} className="form">
          <label className="form-label">
            Your Name
            <input
              className="form-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              maxLength={30}
              autoFocus
              disabled={loading}
            />
          </label>
          <label className="form-label">
            Room Code
            <input
              className="form-input room-code-input"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              maxLength={6}
              disabled={loading}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !displayName.trim() || roomCode.trim().length !== 6}
          >
            {loading ? 'Joining…' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  );
}
