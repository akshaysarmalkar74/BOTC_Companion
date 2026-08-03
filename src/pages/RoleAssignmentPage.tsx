import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { loadSession } from '../lib/roomUtils';
import { recordGameStart } from '../lib/gameHistory';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import type { Player, Team } from '../types';

const TEAM_ORDER: Team[] = ['townsfolk', 'outsider', 'minion', 'demon'];
const TEAM_LABELS: Record<Team, string> = {
  townsfolk: 'Townsfolk',
  outsider: 'Outsiders',
  minion: 'Minions',
  demon: 'Demons',
};

export function RoleAssignmentPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [script, setScript] = useState<string[]>([]);
  /** playerId → characterId */
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const session = loadSession();

  useEffect(() => {
    if (!session?.isHost) navigate('/lobby');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session?.isHost) return null;

  const { roomId } = session;

  // ── Load data ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [{ data: roomData }, { data: playerData }] = await Promise.all([
        supabase.from('rooms').select('script, status').eq('id', roomId).single(),
        supabase
          .from('players')
          .select('id, display_name, seat_order, role, is_host')
          .eq('room_id', roomId)
          .order('seat_order'),
      ]);

      if (roomData?.status === 'in_progress') {
        navigate('/game');
        return;
      }

      const scriptIds: string[] = Array.isArray(roomData?.script)
        ? (roomData.script as string[])
        : [];
      setScript(scriptIds);

      const nonHost = (playerData ?? []).filter((p) => !p.is_host) as Player[];
      setPlayers(nonHost);

      // Restore any existing assignments
      const existing: Record<string, string> = {};
      for (const p of nonHost) {
        if (p.role) existing[p.id] = p.role;
      }
      setAssignments(existing);

      setLoading(false);
    }

    load();
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ──────────────────────────────────────────────────

  const assignedCount = Object.values(assignments).filter(Boolean).length;
  const playerCount = players.length;
  const scriptCount = script.length;
  const countMismatch = playerCount !== scriptCount;

  const allAssigned =
    !countMismatch &&
    playerCount > 0 &&
    players.every((p) => !!assignments[p.id]) &&
    new Set(Object.values(assignments)).size === assignedCount;

  // Characters already assigned to players other than `forPlayerId`
  function takenByOthers(forPlayerId: string): Set<string> {
    const taken = new Set<string>();
    for (const [pid, cid] of Object.entries(assignments)) {
      if (pid !== forPlayerId && cid) taken.add(cid);
    }
    return taken;
  }

  // ── Actions ────────────────────────────────────────────────────────

  function handleRandomAssign() {
    // Fisher-Yates shuffle
    const chars = [...script];
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const next: Record<string, string> = {};
    players.forEach((p, i) => {
      if (chars[i]) next[p.id] = chars[i];
    });
    setAssignments(next);
  }

  function handleManualAssign(playerId: string, charId: string) {
    setAssignments((prev) => ({ ...prev, [playerId]: charId }));
  }

  async function handleStartGame() {
    if (!allAssigned || starting) return;
    setStarting(true);

    try {
      // Write every role assignment to the database
      await Promise.all(
        players.map((p) =>
          supabase
            .from('players')
            .update({ role: assignments[p.id] ?? null })
            .eq('id', p.id)
        )
      );

      // Transition the room to in_progress — triggers all connected clients
      await supabase
        .from('rooms')
        .update({ status: 'in_progress' })
        .eq('id', roomId);

      // Record game start and role assignments to history (fire-and-forget)
      void recordGameStart(roomId, players, assignments, script);

      navigate('/game');
    } finally {
      setStarting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page centered">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  // Unassigned script characters (for the summary panel)
  const assignedCharIds = new Set(Object.values(assignments).filter(Boolean));
  const unassignedChars = script.filter((id) => !assignedCharIds.has(id));

  return (
    <div className="page assign-page">
      <div className="assign-container">
        {/* ── Header ── */}
        <div className="assign-header">
          <button className="btn-back" onClick={() => navigate('/lobby')}>
            ← Back to Lobby
          </button>
          <div className="assign-header-row">
            <h1 className="assign-title">Assign Roles</h1>
            <div className="assign-header-actions">
              <button
                className="btn btn-secondary assign-random-btn"
                onClick={handleRandomAssign}
                disabled={countMismatch || playerCount === 0}
              >
                Randomly Assign All
              </button>
              <button
                className="btn btn-primary assign-start-btn"
                onClick={handleStartGame}
                disabled={!allAssigned || starting}
                title={!allAssigned ? 'All players must be assigned a role first' : undefined}
              >
                {starting ? 'Starting…' : 'Start Game'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mismatch warning ── */}
        {countMismatch && (
          <div className="assign-warning">
            {playerCount === 0
              ? 'No players have joined yet.'
              : scriptCount === 0
              ? 'No script has been configured. Go back and build a script first.'
              : `Script has ${scriptCount} character${scriptCount !== 1 ? 's' : ''} but there ${playerCount === 1 ? 'is' : 'are'} ${playerCount} player${playerCount !== 1 ? 's' : ''}. Adjust the script or wait for more players.`}
          </div>
        )}

        {!countMismatch && playerCount > 0 && (
          <>
            {/* ── Assignment table ── */}
            <div className="assign-table-wrapper">
              <table className="assign-table">
                <thead>
                  <tr>
                    <th className="col-seat">Seat</th>
                    <th className="col-player">Player</th>
                    <th className="col-role">Role</th>
                    <th className="col-team">Team</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, idx) => {
                    const assignedId = assignments[player.id];
                    const assignedChar = assignedId
                      ? TROUBLE_BREWING.find((c) => c.id === assignedId)
                      : null;
                    const taken = takenByOthers(player.id);

                    return (
                      <tr key={player.id} className={assignedId ? 'row-assigned' : 'row-empty'}>
                        <td className="col-seat">{idx + 1}</td>
                        <td className="col-player">{player.display_name}</td>
                        <td className="col-role">
                          <select
                            className="role-select"
                            value={assignedId ?? ''}
                            onChange={(e) =>
                              handleManualAssign(player.id, e.target.value)
                            }
                          >
                            <option value="">— Unassigned —</option>
                            {TEAM_ORDER.map((team) => {
                              const teamChars = script
                                .map((id) => TROUBLE_BREWING.find((c) => c.id === id))
                                .filter(
                                  (c): c is NonNullable<typeof c> =>
                                    !!c && c.team === team
                                );
                              if (teamChars.length === 0) return null;
                              return (
                                <optgroup key={team} label={TEAM_LABELS[team]}>
                                  {teamChars.map((c) => (
                                    <option
                                      key={c.id}
                                      value={c.id}
                                      disabled={taken.has(c.id)}
                                    >
                                      {c.name}
                                      {taken.has(c.id) ? ' (taken)' : ''}
                                    </option>
                                  ))}
                                </optgroup>
                              );
                            })}
                          </select>
                        </td>
                        <td className="col-team">
                          {assignedChar && (
                            <span
                              className={`card-team-badge team-badge-${assignedChar.team}`}
                            >
                              {TEAM_LABELS[assignedChar.team].replace(/s$/, '')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Status / validation ── */}
            <div className="assign-status">
              {allAssigned ? (
                <p className="assign-valid">
                  All {playerCount} players assigned — ready to start.
                </p>
              ) : (
                <div className="assign-invalid">
                  <p>
                    {assignedCount} of {playerCount} players assigned.
                  </p>
                  {unassignedChars.length > 0 && (
                    <p className="assign-unassigned-list">
                      Unassigned:{' '}
                      {unassignedChars.map((id, i) => {
                        const char = TROUBLE_BREWING.find((c) => c.id === id);
                        return (
                          <span
                            key={id}
                            className={`unassigned-char team-${char?.team}`}
                          >
                            {char?.name ?? id}
                            {i < unassignedChars.length - 1 ? ', ' : ''}
                          </span>
                        );
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
