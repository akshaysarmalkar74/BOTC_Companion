import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CharacterCard } from '../components/CharacterCard';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import { getSetup, MIN_PLAYERS, MAX_PLAYERS } from '../data/setupTable';
import { supabase } from '../lib/supabase';
import { loadSession } from '../lib/roomUtils';
import type { Team } from '../types';

interface RecentScript {
  script: string[];
  label: string; // e.g. "Night 2, Day 2"
}

type Filter = 'all' | Team;

const FILTER_TABS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'townsfolk', label: 'Townsfolk' },
  { value: 'outsider', label: 'Outsiders' },
  { value: 'minion', label: 'Minions' },
  { value: 'demon', label: 'Demons' },
];

const TEAM_ORDER: Team[] = ['townsfolk', 'outsider', 'minion', 'demon'];
const TEAM_LABELS: Record<Team, string> = {
  townsfolk: 'Townsfolk',
  outsider: 'Outsiders',
  minion: 'Minions',
  demon: 'Demons',
};

export function ScriptBuilderPage() {
  const [selectedIds, setSelectedIds]   = useState<string[]>([]);
  const [playerCount, setPlayerCount]   = useState(0);
  const [filter, setFilter]             = useState<Filter>('all');
  const [saving, setSaving]             = useState(false);
  const [loading, setLoading]           = useState(true);
  const [recentScripts, setRecentScripts] = useState<RecentScript[]>([]);
  const navigate = useNavigate();

  const session = loadSession();

  // Redirect non-hosts
  useEffect(() => {
    if (!session || !session.isHost) navigate('/lobby');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session?.isHost) return null;

  const { roomId } = session;

  // ── Load existing script and player count ──────────────────────────
  useEffect(() => {
    async function load() {
      const [{ data: room }, { data: players }, { data: gameEvents }] = await Promise.all([
        supabase.from('rooms').select('script').eq('id', roomId).single(),
        supabase
          .from('players')
          .select('id')
          .eq('room_id', roomId)
          .eq('is_host', false),
        supabase
          .from('game_events')
          .select('metadata, phase')
          .eq('room_id', roomId)
          .eq('event_type', 'game_start')
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      if (room?.script && Array.isArray(room.script)) {
        setSelectedIds(room.script as string[]);
      }
      setPlayerCount(players?.length ?? 0);

      if (gameEvents && gameEvents.length > 0) {
        const recent: RecentScript[] = gameEvents
          .map((e, idx) => {
            const meta = e.metadata as { script?: string[] };
            const script = meta?.script;
            if (!Array.isArray(script) || script.length === 0) return null;
            return {
              script,
              label: `Previous game ${idx === 0 ? '(latest)' : idx === 1 ? '(2nd)' : '(3rd)'}`,
            };
          })
          .filter((s): s is RecentScript => s !== null);
        setRecentScripts(recent);
      }

      setLoading(false);
    }
    load();
  }, [roomId]);

  // ── Derived state ──────────────────────────────────────────────────

  const hasBaron = selectedIds.includes('baron');
  const setup = getSetup(playerCount, hasBaron);

  // How many of each team are currently selected
  const counts: Record<Team, number> = {
    townsfolk: 0,
    outsider: 0,
    minion: 0,
    demon: 0,
  };
  for (const id of selectedIds) {
    const char = TROUBLE_BREWING.find((c) => c.id === id);
    if (char) counts[char.team]++;
  }

  // Whether all quotas are exactly met
  const isValid =
    setup !== null &&
    counts.townsfolk === setup.townsfolk &&
    counts.outsider === setup.outsiders &&
    counts.minion === setup.minions &&
    counts.demon === setup.demons;

  const isPlayerCountValid =
    playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS;

  // ── Character interaction ──────────────────────────────────────────

  /**
   * Returns true if a character can be added to the current selection
   * without exceeding its team's quota.
   */
  function canAdd(charId: string): boolean {
    if (!setup) return false;
    const char = TROUBLE_BREWING.find((c) => c.id === charId);
    if (!char) return false;

    // After adding charId, does Baron status change?
    const newHasBaron = charId === 'baron' ? true : hasBaron;
    const newSetup = getSetup(playerCount, newHasBaron);
    if (!newSetup) return false;

    const limit =
      char.team === 'townsfolk'
        ? newSetup.townsfolk
        : char.team === 'outsider'
        ? newSetup.outsiders
        : char.team === 'minion'
        ? newSetup.minions
        : newSetup.demons;

    return counts[char.team] < limit;
  }

  function toggleCharacter(charId: string) {
    if (selectedIds.includes(charId)) {
      // Always allow deselection
      setSelectedIds((prev) => prev.filter((id) => id !== charId));
    } else {
      if (canAdd(charId)) {
        setSelectedIds((prev) => [...prev, charId]);
      }
    }
  }

  // ── Save ───────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    await supabase
      .from('rooms')
      .update({ script: selectedIds })
      .eq('id', roomId);
    setSaving(false);
    navigate('/lobby');
  }

  // ── Filtered character list ────────────────────────────────────────

  const visible =
    filter === 'all'
      ? TROUBLE_BREWING
      : TROUBLE_BREWING.filter((c) => c.team === filter);

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page centered">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page script-page">
      <div className="script-container">
        {/* Header */}
        <div className="script-header">
          <button className="btn-back" onClick={() => navigate('/lobby')}>
            ← Back
          </button>
          <div className="script-header-row">
            <h1 className="script-title">Script Builder</h1>
            <button
              className="btn btn-primary script-save-btn"
              onClick={handleSave}
              disabled={saving || !isValid}
              title={!isValid ? 'Fix the script before saving' : undefined}
            >
              {saving ? 'Saving…' : 'Save Script'}
            </button>
          </div>
        </div>

        {/* Recent scripts */}
        {recentScripts.length > 0 && (
          <div className="recent-scripts">
            <span className="recent-scripts-label">Recent:</span>
            {recentScripts.map((rs, i) => (
              <button
                key={i}
                className="btn btn-secondary recent-script-btn"
                onClick={() => setSelectedIds(rs.script)}
                title={rs.script.join(', ')}
              >
                {rs.label}
              </button>
            ))}
          </div>
        )}

        {/* Player count + setup overview */}
        <div className="setup-panel">
          {!isPlayerCountValid ? (
            <p className="setup-warning">
              {playerCount === 0
                ? 'No players have joined yet. The script requires at least 5 players.'
                : playerCount < MIN_PLAYERS
                ? `${playerCount} player${playerCount !== 1 ? 's' : ''} joined — need at least ${MIN_PLAYERS}.`
                : `${playerCount} players joined — maximum supported is ${MAX_PLAYERS}.`}
            </p>
          ) : (
            <>
              <div className="setup-player-count">
                <span className="setup-label">Players</span>
                <span className="setup-value">{playerCount}</span>
                {hasBaron && (
                  <span className="setup-baron-note">Baron active (+2 Outsiders)</span>
                )}
              </div>

              <div className="setup-quotas">
                {TEAM_ORDER.map((team) => {
                  const required =
                    team === 'townsfolk'
                      ? setup!.townsfolk
                      : team === 'outsider'
                      ? setup!.outsiders
                      : team === 'minion'
                      ? setup!.minions
                      : setup!.demons;
                  const current = counts[team];
                  const done = current === required;
                  const over = current > required;

                  return (
                    <div
                      key={team}
                      className={`setup-quota team-quota-${team} ${done ? 'done' : ''} ${over ? 'over' : ''}`}
                    >
                      <span className="quota-team">{TEAM_LABELS[team]}</span>
                      <span className="quota-fraction">
                        {current}/{required}
                      </span>
                      <div className="quota-pip-row">
                        {Array.from({ length: required }).map((_, i) => (
                          <div
                            key={i}
                            className={`quota-pip ${i < current ? 'filled' : ''} ${over && i < current ? 'over' : ''}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Validation message */}
              {isValid ? (
                <p className="setup-valid">Script is valid — ready to save.</p>
              ) : (
                <p className="setup-invalid">
                  {TEAM_ORDER.map((team) => {
                    const required =
                      team === 'townsfolk'
                        ? setup!.townsfolk
                        : team === 'outsider'
                        ? setup!.outsiders
                        : team === 'minion'
                        ? setup!.minions
                        : setup!.demons;
                    const current = counts[team];
                    if (current === required) return null;
                    const diff = required - current;
                    return (
                      <span key={team} className="invalid-item">
                        {diff > 0
                          ? `${diff} more ${TEAM_LABELS[team]} needed`
                          : `${Math.abs(diff)} too many ${TEAM_LABELS[team]}`}
                      </span>
                    );
                  })}
                </p>
              )}
            </>
          )}
        </div>

        {/* Filter tabs */}
        <div className="filter-tabs" role="tablist">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.value === 'all'
                ? TROUBLE_BREWING.length
                : TROUBLE_BREWING.filter((c) => c.team === tab.value).length;
            return (
              <button
                key={tab.value}
                role="tab"
                aria-selected={filter === tab.value}
                className={`filter-tab${filter === tab.value ? ' active' : ''}`}
                onClick={() => setFilter(tab.value)}
              >
                {tab.label}
                <span className="filter-tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Character grid */}
        <div className="character-grid">
          {visible.map((character) => {
            const sel = selectedIds.includes(character.id);
            const dis = !isPlayerCountValid
              ? false
              : !sel && !canAdd(character.id);
            return (
              <CharacterCard
                key={character.id}
                character={character}
                selected={sel}
                disabled={dis}
                onClick={() => toggleCharacter(character.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
