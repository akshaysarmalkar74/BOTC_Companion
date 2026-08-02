import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { generateRoomCode, saveSession } from '../lib/roomUtils';

export function CreateRoomPage() {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) return;

    setLoading(true);
    setError(null);

    try {
      // Generate a unique room code, retrying on collision
      let code = generateRoomCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: existing } = await supabase
          .from('rooms')
          .select('id')
          .eq('code', code)
          .maybeSingle();
        if (!existing) break;
        code = generateRoomCode();
      }

      // Create the room
      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .insert({ code })
        .select()
        .single();

      if (roomErr || !room) throw new Error(roomErr?.message ?? 'Failed to create room');

      // Create the host player
      const { data: player, error: playerErr } = await supabase
        .from('players')
        .insert({
          room_id: room.id,
          display_name: name,
          is_host: true,
          seat_order: 0,
        })
        .select()
        .single();

      if (playerErr || !player) throw new Error(playerErr?.message ?? 'Failed to create player');

      // Link the host player back to the room
      await supabase.from('rooms').update({ host_id: player.id }).eq('id', room.id);

      saveSession(player.id, room.id, true);
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
        <h2 className="form-title">Create Room</h2>
        <form onSubmit={handleCreate} className="form">
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
          {error && <p className="form-error">{error}</p>}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !displayName.trim()}
          >
            {loading ? 'Creating…' : 'Create Room'}
          </button>
        </form>
      </div>
    </div>
  );
}
