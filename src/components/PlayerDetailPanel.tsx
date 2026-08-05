import { useState, useEffect } from 'react';
import type { Player, Character, ReminderToken } from '../types';
import { TOKEN_BY_KEY, groupByCharacter } from '../data/reminderTokens';
import { TROUBLE_BREWING } from '../data/troubleBrewing';

const TEAM_LABELS: Record<string, string> = {
  townsfolk: 'Townsfolk',
  outsider:  'Outsider',
  minion:    'Minion',
  demon:     'Demon',
};

// Pre-compute grouped tokens and character name lookup once
const GROUPED_TOKENS = groupByCharacter();
const CHAR_NAME = new Map(TROUBLE_BREWING.map((c) => [c.id, c.name]));

interface Props {
  player: Player;
  character: Character | null;
  /** For the Drunk: the fake Townsfolk role they think they have */
  drunkRoleChar: Character | null;
  playerTokens: ReminderToken[];
  onClose: () => void;
  onToggleAlive: (playerId: string) => void;
  onToggleGhostVote: (playerId: string) => void;
  onNotesSave: (playerId: string, notes: string) => void;
  onAddToken: (tokenKey: string) => void;
  onRemoveToken: (tokenId: string) => void;
}

export function PlayerDetailPanel({
  player,
  character,
  drunkRoleChar,
  playerTokens,
  onClose,
  onToggleAlive,
  onToggleGhostVote,
  onNotesSave,
  onAddToken,
  onRemoveToken,
}: Props) {
  const [notes, setNotes] = useState(player.notes);
  const [notesFocused, setNotesFocused] = useState(false);
  const [isAddingToken, setIsAddingToken] = useState(false);

  // Sync notes from parent when not focused (realtime from another host window)
  useEffect(() => {
    if (!notesFocused) setNotes(player.notes);
  }, [player.notes, notesFocused]);

  const handleNotesBlur = () => {
    setNotesFocused(false);
    if (notes !== player.notes) {
      onNotesSave(player.id, notes);
    }
  };

  const handleSelectToken = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    if (!key) return;
    onAddToken(key);
    // Reset the select and close the add UI
    e.target.value = '';
    setIsAddingToken(false);
  };

  return (
    <>
      {/* Dim backdrop — clicking it closes the panel */}
      <div className="panel-backdrop" onClick={onClose} aria-hidden="true" />

      <div
        className="player-panel"
        role="dialog"
        aria-label={`${player.display_name} — Storyteller view`}
      >
        {/* ── Header ── */}
        <div className="panel-header">
          <div className="panel-header-info">
            <h2 className="panel-player-name">{player.display_name}</h2>
            {character ? (
              <>
                <div className="panel-character-row">
                  <span className={`card-team-badge team-badge-${character.team}`}>
                    {TEAM_LABELS[character.team] ?? character.team}
                  </span>
                  <span className="panel-character-name">{character.name}</span>
                </div>
                {drunkRoleChar && (
                  <div className="panel-drunk-row">
                    <span className="panel-drunk-label">Thinks they are:</span>
                    <span className="panel-drunk-role">{drunkRoleChar.name}</span>
                  </div>
                )}
              </>
            ) : (
              <span className="panel-no-role">No role assigned</span>
            )}
          </div>
          <button
            className="panel-close-btn"
            onClick={onClose}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {/* ── Character ability ── */}
        {character && (
          <p className="panel-ability">{character.ability}</p>
        )}
        {drunkRoleChar && (
          <p className="panel-ability panel-ability--drunk">
            Fake ability shown to player: {drunkRoleChar.ability}
          </p>
        )}

        {/* ── Status controls ── */}
        <div className="panel-controls">
          <div className="panel-control-row">
            <span className="panel-control-label">
              {player.is_alive ? 'Alive' : 'Dead'}
            </span>
            <button
              className={`panel-toggle-btn${!player.is_alive ? ' panel-toggle-btn--danger' : ''}`}
              onClick={() => onToggleAlive(player.id)}
            >
              {player.is_alive ? 'Mark as Dead' : 'Revive'}
            </button>
          </div>

          {!player.is_alive && (
            <div className="panel-control-row">
              <span className="panel-control-label">Ghost Vote</span>
              <button
                className={`panel-toggle-btn${player.ghost_vote_used ? ' panel-toggle-btn--muted' : ''}`}
                onClick={() => onToggleGhostVote(player.id)}
              >
                {player.ghost_vote_used ? 'Used' : 'Available'}
              </button>
            </div>
          )}
        </div>

        {/* ── Reminder Tokens ── */}
        <div className="panel-tokens-section">
          <div className="panel-tokens-header">
            <span className="panel-notes-label">Reminder Tokens</span>
            <button
              className="panel-add-token-btn"
              onClick={() => setIsAddingToken((v) => !v)}
              aria-expanded={isAddingToken}
            >
              {isAddingToken ? 'Cancel' : '＋ Add Token'}
            </button>
          </div>

          {/* Token picker — inline select with optgroups by character */}
          {isAddingToken && (
            <select
              className="panel-token-select"
              defaultValue=""
              onChange={handleSelectToken}
              autoFocus
            >
              <option value="" disabled>— Choose a reminder token —</option>
              {Array.from(GROUPED_TOKENS.entries()).map(([charId, tokens]) => (
                <optgroup
                  key={charId}
                  label={CHAR_NAME.get(charId) ?? charId}
                >
                  {tokens.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}

          {/* Existing tokens */}
          {playerTokens.length > 0 ? (
            <div className="panel-token-list">
              {playerTokens.map((dbToken) => {
                const def = TOKEN_BY_KEY.get(dbToken.token_key);
                if (!def) return null;
                const charName = CHAR_NAME.get(def.characterId) ?? def.characterId;
                return (
                  <div key={dbToken.id} className="panel-token-row">
                    <span
                      className="panel-token-chip"
                      style={{ background: def.color }}
                    >
                      {def.label}
                    </span>
                    <span className="panel-token-source">{charName}</span>
                    <button
                      className="panel-token-remove"
                      onClick={() => onRemoveToken(dbToken.id)}
                      aria-label={`Remove ${def.label} token`}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            !isAddingToken && (
              <p className="panel-tokens-empty">No reminder tokens.</p>
            )
          )}
        </div>

        {/* ── Storyteller notes ── */}
        <div className="panel-notes-section">
          <label className="panel-notes-label" htmlFor={`notes-${player.id}`}>
            Storyteller Notes
          </label>
          <textarea
            id={`notes-${player.id}`}
            className="panel-notes-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onFocus={() => setNotesFocused(true)}
            onBlur={handleNotesBlur}
            placeholder="e.g. Claims Chef · Suspicious · Probably Poisoned"
            rows={3}
          />
        </div>
      </div>
    </>
  );
}
