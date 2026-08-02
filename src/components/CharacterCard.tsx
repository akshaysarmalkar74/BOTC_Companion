import type { Character, Team } from '../types';

interface Props {
  character: Character;
  /** Show as selected (script builder only) */
  selected?: boolean;
  /** Greyed out — team quota is full, cannot be added */
  disabled?: boolean;
  onClick?: () => void;
}

const TEAM_LABELS: Record<Team, string> = {
  townsfolk: 'Townsfolk',
  outsider: 'Outsider',
  minion: 'Minion',
  demon: 'Demon',
};

export function CharacterCard({ character, selected, disabled, onClick }: Props) {
  const isInteractive = !!onClick;

  const classes = [
    'character-card',
    `team-${character.team}`,
    selected && 'is-selected',
    disabled && 'is-disabled',
    isInteractive && 'is-interactive',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onClick={disabled ? undefined : onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive && !disabled ? 0 : undefined}
      onKeyDown={
        isInteractive && !disabled
          ? (e) => e.key === 'Enter' && onClick?.()
          : undefined
      }
      aria-pressed={isInteractive ? selected : undefined}
      aria-disabled={disabled}
    >
      {/* Team colour bar */}
      <div className="card-team-bar" />

      <div className="card-body">
        <div className="card-header">
          <span className="card-name">{character.name}</span>
          <span className={`card-team-badge team-badge-${character.team}`}>
            {TEAM_LABELS[character.team]}
          </span>
        </div>

        <p className="card-ability">{character.ability}</p>
      </div>

      {/* Selection checkmark */}
      {selected && (
        <div className="card-check" aria-hidden="true">
          ✓
        </div>
      )}
    </div>
  );
}
