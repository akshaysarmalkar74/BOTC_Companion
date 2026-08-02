import type { Character, Team } from '../types';

const TEAM_LABELS: Record<Team, string> = {
  townsfolk: 'Townsfolk',
  outsider: 'Outsider',
  minion: 'Minion',
  demon: 'Demon',
};

interface Props {
  character: Character;
  onHide: () => void;
}

export function RoleRevealCard({ character, onHide }: Props) {
  return (
    <div className={`role-reveal-card team-${character.team}`}>
      {/* Team colour strip along the top */}
      <div className="reveal-top-bar" />

      <div className="reveal-body">
        {/* Team badge */}
        <span className={`card-team-badge team-badge-${character.team} reveal-team-badge`}>
          {TEAM_LABELS[character.team]}
        </span>

        {/* Character name */}
        <h1 className="reveal-name">{character.name}</h1>

        {/* Ability box — exactly as printed on the token */}
        <div className="reveal-ability-box">
          <p className="reveal-ability">{character.ability}</p>
        </div>

        {/* Plain-language description */}
        <p className="reveal-description">{character.description}</p>

        {/* Hide button */}
        <button className="btn btn-secondary reveal-hide-btn" onClick={onHide}>
          Hide Role
        </button>
      </div>
    </div>
  );
}
