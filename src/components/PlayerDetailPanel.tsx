import { useState, useEffect } from 'react';
import type { Player, Character } from '../types';

const TEAM_LABELS: Record<string, string> = {
  townsfolk: 'Townsfolk',
  outsider:  'Outsider',
  minion:    'Minion',
  demon:     'Demon',
};

interface Props {
  player: Player;
  character: Character | null;
  onClose: () => void;
  onToggleAlive: (playerId: string) => void;
  onToggleGhostVote: (playerId: string) => void;
  onNotesSave: (playerId: string, notes: string) => void;
}

export function PlayerDetailPanel({
  player,
  character,
  onClose,
  onToggleAlive,
  onToggleGhostVote,
  onNotesSave,
}: Props) {
  const [notes, setNotes] = useState(player.notes);
  // Track whether the textarea is focused so we don't overwrite in-progress edits
  const [notesFocused, setNotesFocused] = useState(false);

  // Sync notes from parent (e.g. another host window updated via realtime)
  useEffect(() => {
    if (!notesFocused) setNotes(player.notes);
  }, [player.notes, notesFocused]);

  const handleNotesBlur = () => {
    setNotesFocused(false);
    if (notes !== player.notes) {
      onNotesSave(player.id, notes);
    }
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
              <div className="panel-character-row">
                <span className={`card-team-badge team-badge-${character.team}`}>
                  {TEAM_LABELS[character.team] ?? character.team}
                </span>
                <span className="panel-character-name">{character.name}</span>
              </div>
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

          {/* Ghost vote is only relevant when the player is dead */}
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
