import type { Player, Character } from '../types';

interface Props {
  player: Player;
  character: Character | null;
  /** Left position as a percentage of the seating-circle container */
  x: number;
  /** Top position as a percentage of the seating-circle container */
  y: number;
  /** Angle in radians (0 = right, -π/2 = top) */
  angle: number;
  isSelected: boolean;
  onClick: () => void;
}

// Must stay in sync with --seat-size: 56px / 2 in CSS
const TOKEN_RADIUS_PX = 28;
// Gap between the token edge and the centre of the label
const LABEL_GAP_PX = 12;

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function GrimoireSeat({
  player,
  character,
  x,
  y,
  angle,
  isSelected,
  onClick,
}: Props) {
  const labelDist = TOKEN_RADIUS_PX + LABEL_GAP_PX;
  const lx = Math.cos(angle) * labelDist;
  const ly = Math.sin(angle) * labelDist;

  const seatClasses = [
    'grimoire-seat',
    isSelected && 'is-selected',
    !player.is_alive && 'is-dead',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={seatClasses}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`${player.display_name}${character ? `, ${character.name}` : ''}${!player.is_alive ? ', Dead' : ''}`}
      aria-pressed={isSelected}
    >
      {/*
       * ── Grimoire token ──────────────────────────────────────────────
       * Reuses .seat-token sizing.
       * Dead state dims the token and shows a death cross.
       * Ghost-vote dot appears on dead tokens whose vote is still available.
       *
       * Space around the token perimeter is reserved for future:
       *   - Reminder tokens (satellite circles)
       *   - Poison / drunk / protected markers
       */}
      <div className={`seat-token grimoire-token${!player.is_alive ? ' grimoire-token--dead' : ''}`}>
        <span className="seat-initials" aria-hidden="true">
          {getInitials(player.display_name)}
        </span>

        {/* Death cross — visible when dead */}
        {!player.is_alive && (
          <span className="grimoire-death-cross" aria-hidden="true">†</span>
        )}

        {/* Ghost vote dot — visible when dead and vote not yet used */}
        {!player.is_alive && !player.ghost_vote_used && (
          <span
            className="grimoire-ghost-dot"
            title="Ghost vote available"
            aria-hidden="true"
          />
        )}
      </div>

      {/*
       * ── Name + role label ────────────────────────────────────────────
       * Shares .seat-label CSS (--lx/--ly radial positioning).
       * Shows player name on line 1 and character name on line 2.
       */}
      <div
        className="seat-label grimoire-label"
        style={{ '--lx': `${lx}px`, '--ly': `${ly}px` } as React.CSSProperties}
      >
        <span className={`seat-name grimoire-label-name${!player.is_alive ? ' is-dead' : ''}`}>
          {player.display_name}
        </span>
        {character && (
          <span className="grimoire-label-role">{character.name}</span>
        )}
      </div>
    </div>
  );
}
