import type { Player, Character } from '../types';

/** A resolved reminder token ready for display on the seat. */
export interface SeatToken {
  id: string;
  label: string;
  color: string;
}

interface Props {
  player: Player;
  character: Character | null;
  /** Left position as a percentage of the seating-circle container */
  x: number;
  /** Top position as a percentage of the seating-circle container */
  y: number;
  /** Angle in radians (0 = right, −π/2 = top) */
  angle: number;
  isSelected: boolean;
  tokens: SeatToken[];
  onClick: () => void;
}

// Must stay in sync with --seat-size: 56px / 2 in CSS
const TOKEN_RADIUS_PX = 28;
// Gap between the token edge and the centre of the label
const LABEL_GAP_PX = 14;
// Max reminder tokens shown inline before collapsing into "+N more"
const MAX_VISIBLE_CHIPS = 3;

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
  tokens,
  onClick,
}: Props) {
  const labelDist = TOKEN_RADIUS_PX + LABEL_GAP_PX;
  const lx = Math.cos(angle) * labelDist;
  const ly = Math.sin(angle) * labelDist;

  // Reminder chip display: cap at MAX_VISIBLE_CHIPS + overflow count
  const visibleTokens = tokens.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = tokens.length - visibleTokens.length;

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
      aria-label={`${player.display_name}${character ? `, ${character.name}` : ''}${!player.is_alive ? ', Dead' : ''}${tokens.length ? `, ${tokens.length} reminder token${tokens.length !== 1 ? 's' : ''}` : ''}`}
      aria-pressed={isSelected}
    >
      {/*
       * ── Grimoire token ──────────────────────────────────────────────
       * Dead state dims the token and shows a death cross.
       * Ghost-vote dot appears on dead tokens whose vote is still available.
       *
       * Perimeter is reserved for future reminder token satellites.
       */}
      <div className={`seat-token grimoire-token${!player.is_alive ? ' grimoire-token--dead' : ''}`}>
        <span className="seat-initials" aria-hidden="true">
          {getInitials(player.display_name)}
        </span>

        {!player.is_alive && (
          <span className="grimoire-death-cross" aria-hidden="true">†</span>
        )}

        {!player.is_alive && !player.ghost_vote_used && (
          <span
            className="grimoire-ghost-dot"
            title="Ghost vote available"
            aria-hidden="true"
          />
        )}
      </div>

      {/*
       * ── Radial label ────────────────────────────────────────────────
       * Positioned outward from the token centre using --lx / --ly.
       * Shows: player name · character name · reminder token chips.
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

        {/* Reminder token chips */}
        {tokens.length > 0 && (
          <div className="grimoire-chips" aria-hidden="true">
            {visibleTokens.map((t) => (
              <span
                key={t.id}
                className="grimoire-chip"
                style={{ background: t.color }}
                title={t.label}
              >
                {t.label}
              </span>
            ))}
            {overflow > 0 && (
              <span className="grimoire-chip grimoire-chip--overflow" title={`${overflow} more token${overflow !== 1 ? 's' : ''}`}>
                +{overflow}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
