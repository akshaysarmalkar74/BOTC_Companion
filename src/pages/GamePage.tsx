import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadSession } from '../lib/roomUtils';
import { RoleRevealCard } from '../components/RoleRevealCard';
import { GrimoireCircle } from '../components/GrimoireCircle';
import { PlayerDetailPanel } from '../components/PlayerDetailPanel';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import { recordManualDeath, recordGameEnd, recordReminderAdded, recordReminderRemoved } from '../lib/gameHistory';
import { detectWinCondition, detectScarletWomanPromotion, type WinDetection, type DemonPromotion } from '../lib/winConditions';
import type { Player, Room, ReminderToken } from '../types';

export function GamePage() {
  const [room, setRoom]                     = useState<Room | null>(null);
  const [myRole, setMyRole]                 = useState<string | null>(null);
  const [allPlayers, setAllPlayers]         = useState<Player[]>([]);
  const [reminderTokens, setReminderTokens] = useState<ReminderToken[]>([]);
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [revealed, setRevealed]             = useState(false);
  const [loading, setLoading]               = useState(true);
  const [showEndModal, setShowEndModal]     = useState(false);
  const [endingGame, setEndingGame]         = useState(false);
  const [winAlert, setWinAlert]             = useState<WinDetection | null>(null);
  const [demonPromotion, setDemonPromotion] = useState<DemonPromotion | null>(null);
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
      const { data: roomData } = await supabase
        .from('rooms')
        .select('id, code, status, script, host_id, phase, night_step_key, outcome, ended_at, created_at')
        .eq('id', roomId)
        .single();

      if (!roomData || (roomData.status !== 'in_progress' && roomData.status !== 'completed')) {
        navigate('/lobby');
        return;
      }
      setRoom(roomData as Room);

      if (isHost) {
        const [{ data: players }, { data: tokens }] = await Promise.all([
          supabase
            .from('players')
            .select(
              'id, display_name, seat_order, is_host, role, drunk_role, is_alive, ghost_vote_used, notes, room_id, created_at'
            )
            .eq('room_id', roomId)
            .eq('is_host', false)
            .order('seat_order'),
          supabase
            .from('reminder_tokens')
            .select('id, player_id, room_id, token_key, created_at')
            .eq('room_id', roomId),
        ]);

        setAllPlayers((players ?? []) as Player[]);
        setReminderTokens((tokens ?? []) as ReminderToken[]);
      } else {
        // Players only fetch their own role — no other player data is read
        const { data: me } = await supabase
          .from('players')
          .select('role, drunk_role')
          .eq('id', playerId)
          .single();

        // If the player is the Drunk, show them their fake Townsfolk role —
        // they must never know they are the Drunk.
        const displayRole =
          me?.role === 'drunk' && me?.drunk_role ? me.drunk_role : me?.role;
        setMyRole(displayRole ?? null);
      }

      setLoading(false);
    }

    load();
  }, [roomId, playerId, isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime (non-host): redirect to /win when game ends ────────────
  useEffect(() => {
    if (isHost) return;

    const ch = supabase.channel(`game-end-watch:${roomId}`);
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        if ((payload.new as { status: string }).status === 'completed') {
          navigate('/win');
        }
      }
    ).subscribe();

    return () => { ch.unsubscribe(); };
  }, [roomId, isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime (host only) ────────────────────────────────────────────
  useEffect(() => {
    if (!isHost) return;

    const channel = supabase.channel(`grimoire:${roomId}`);

    channel
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as Player;
          setAllPlayers((prev) =>
            prev.map((p) =>
              p.id === updated.id
                ? {
                    ...p,
                    display_name:    updated.display_name,
                    is_alive:        updated.is_alive,
                    ghost_vote_used: updated.ghost_vote_used,
                    notes:           updated.notes,
                  }
                : p
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as Room;
          setRoom((prev) => (prev ? { ...prev, phase: updated.phase } : prev));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reminder_tokens', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const newToken = payload.new as ReminderToken;
          setReminderTokens((prev) => {
            // Deduplicate — optimistic insert may already be present
            if (prev.find((t) => t.id === newToken.id)) return prev;
            return [...prev, newToken];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reminder_tokens', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setReminderTokens((prev) => prev.filter((t) => t.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Host actions ────────────────────────────────────────────────────

  const handleToggleAlive = async (targetId: string) => {
    const player = allPlayers.find((p) => p.id === targetId);
    if (!player) return;
    const newAlive = !player.is_alive;
    const updatedPlayers = allPlayers.map((p) => (p.id === targetId ? { ...p, is_alive: newAlive } : p));
    setAllPlayers(updatedPlayers);
    await supabase.from('players').update({ is_alive: newAlive }).eq('id', targetId);
    // Record manual death (not resurrection) to history
    if (!newAlive && room) {
      void recordManualDeath(roomId, room.phase, targetId, allPlayers);
      // Scarlet Woman promotion takes priority over Good-wins check
      const promotion = detectScarletWomanPromotion(updatedPlayers);
      if (promotion) {
        setDemonPromotion(promotion);
      } else {
        const win = detectWinCondition(updatedPlayers);
        if (win) setWinAlert(win);
      }
    }
  };

  const handlePromoteScarletWoman = async (swId: string) => {
    await supabase.from('players').update({ role: 'imp' }).eq('id', swId);
    setAllPlayers((prev) => prev.map((p) => p.id === swId ? { ...p, role: 'imp' } : p));
    setDemonPromotion(null);
  };

  const handleToggleGhostVote = async (targetId: string) => {
    const player = allPlayers.find((p) => p.id === targetId);
    if (!player) return;
    const newUsed = !player.ghost_vote_used;
    setAllPlayers((prev) =>
      prev.map((p) => (p.id === targetId ? { ...p, ghost_vote_used: newUsed } : p))
    );
    await supabase.from('players').update({ ghost_vote_used: newUsed }).eq('id', targetId);
  };

  const handleNotesSave = async (targetId: string, notes: string) => {
    setAllPlayers((prev) =>
      prev.map((p) => (p.id === targetId ? { ...p, notes } : p))
    );
    await supabase.from('players').update({ notes }).eq('id', targetId);
  };

  const handlePhaseChange = async (phase: string) => {
    setRoom((prev) => (prev ? { ...prev, phase } : prev));
    await supabase.from('rooms').update({ phase }).eq('id', roomId);
  };

  const handleOpenNightAssistant = async () => {
    if (!room) return;
    // If currently in a day phase, advance to the next night before opening
    if (room.phase.startsWith('Day')) {
      const n = parseInt(room.phase.split(' ')[1]) || 1;
      const newPhase = `Night ${n + 1}`;
      await supabase
        .from('rooms')
        .update({ phase: newPhase, night_step_key: null })
        .eq('id', roomId);
      setRoom((prev) => prev ? { ...prev, phase: newPhase, night_step_key: null } : prev);
    }
    navigate('/night');
  };

  const handleAddToken = async (tokenKey: string) => {
    if (!selectedId || !room) return;
    const { data, error } = await supabase
      .from('reminder_tokens')
      .insert({ player_id: selectedId, room_id: room.id, token_key: tokenKey })
      .select('id, player_id, room_id, token_key, created_at')
      .single();
    if (!error && data) {
      setReminderTokens((prev) => [...prev, data as ReminderToken]);
      void recordReminderAdded(roomId, room.phase, tokenKey, selectedId, allPlayers);
    }
  };

  const handleRemoveToken = async (tokenId: string) => {
    const token = reminderTokens.find((t) => t.id === tokenId);
    setReminderTokens((prev) => prev.filter((t) => t.id !== tokenId));
    await supabase.from('reminder_tokens').delete().eq('id', tokenId);
    if (token && room) {
      void recordReminderRemoved(roomId, room.phase, token.token_key, token.player_id, allPlayers);
    }
  };

  const handleEndGame = async (outcome: 'good' | 'evil' | 'cancelled') => {
    if (!room) return;
    setEndingGame(true);
    const endedAt = new Date().toISOString();
    await supabase
      .from('rooms')
      .update({ status: 'completed', outcome, ended_at: endedAt })
      .eq('id', roomId);
    void recordGameEnd(roomId, room.phase, outcome, allPlayers);
    setEndingGame(false);
    navigate('/win');
  };

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page centered">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  // ── Host view — Storyteller Grimoire ───────────────────────────────
  if (isHost) {
    const selectedPlayer = selectedId
      ? (allPlayers.find((p) => p.id === selectedId) ?? null)
      : null;
    const selectedCharacter = selectedPlayer?.role
      ? (TROUBLE_BREWING.find((c) => c.id === selectedPlayer.role) ?? null)
      : null;
    // The fake Townsfolk role the Drunk player thinks they have
    const selectedDrunkRoleChar =
      selectedPlayer?.role === 'drunk' && selectedPlayer.drunk_role
        ? (TROUBLE_BREWING.find((c) => c.id === selectedPlayer.drunk_role) ?? null)
        : null;
    const selectedPlayerTokens = selectedId
      ? reminderTokens.filter((t) => t.player_id === selectedId)
      : [];

    // If somehow the host lands back on /game after completion, redirect to /win
    if (room?.status === 'completed') {
      navigate('/win');
      return null;
    }

    return (
      <div className="grimoire-page">
        <header className="grimoire-header">
          <div className="room-code-group">
            <span className="room-code-label">Room</span>
            <span className="room-code-value">{room?.code}</span>
          </div>
          <span className="host-badge">Storyteller</span>
          <button
            className="btn btn-secondary grimoire-history-btn"
            onClick={() => navigate('/history')}
          >
            History
          </button>
          {room?.phase.startsWith('Day') && (
            <button
              className="btn btn-secondary grimoire-day-btn"
              onClick={() => navigate('/day')}
            >
              Day Manager
            </button>
          )}
          <button
            className="btn btn-primary grimoire-night-btn"
            onClick={handleOpenNightAssistant}
          >
            {room?.night_step_key && room.night_step_key !== 'complete'
              ? 'Continue Night'
              : room?.phase.startsWith('Day')
              ? `Start Night ${parseInt(room.phase.split(' ')[1] || '1') + 1}`
              : 'Night Assistant'}
          </button>
          <button
            className="btn btn-danger grimoire-end-btn"
            onClick={() => setShowEndModal(true)}
          >
            End Game
          </button>
        </header>

        <div className="grimoire-circle-area">
          {room && (
            <GrimoireCircle
              players={allPlayers}
              selectedId={selectedId}
              onSelect={setSelectedId}
              room={room}
              onPhaseChange={handlePhaseChange}
              reminderTokens={reminderTokens}
            />
          )}
        </div>

        {selectedPlayer && (
          <PlayerDetailPanel
            player={selectedPlayer}
            character={selectedCharacter}
            drunkRoleChar={selectedDrunkRoleChar}
            playerTokens={selectedPlayerTokens}
            onClose={() => setSelectedId(null)}
            onToggleAlive={handleToggleAlive}
            onToggleGhostVote={handleToggleGhostVote}
            onNotesSave={handleNotesSave}
            onAddToken={handleAddToken}
            onRemoveToken={handleRemoveToken}
          />
        )}

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

        {/* End Game Modal */}
        {showEndModal && (
          <div className="modal-overlay" onClick={() => setShowEndModal(false)}>
            <div className="modal-card end-game-modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">End Game</h2>
              <p className="modal-subtitle">Declare the outcome:</p>
              <div className="end-game-options">
                <button
                  className="btn end-game-btn end-game-good"
                  onClick={() => handleEndGame('good')}
                  disabled={endingGame}
                >
                  Good Wins
                </button>
                <button
                  className="btn end-game-btn end-game-evil"
                  onClick={() => handleEndGame('evil')}
                  disabled={endingGame}
                >
                  Evil Wins
                </button>
                <button
                  className="btn end-game-btn end-game-cancel"
                  onClick={() => handleEndGame('cancelled')}
                  disabled={endingGame}
                >
                  Cancel Game
                </button>
              </div>
              <button
                className="btn btn-secondary modal-dismiss"
                onClick={() => setShowEndModal(false)}
                disabled={endingGame}
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Player view ────────────────────────────────────────────────────

  const myCharacter = myRole
    ? (TROUBLE_BREWING.find((c) => c.id === myRole) ?? null)
    : null;

  if (revealed && myCharacter) {
    return (
      <div className="page centered reveal-page">
        <RoleRevealCard character={myCharacter} onHide={() => setRevealed(false)} />
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
