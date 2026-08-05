import type { Player } from '../types';

interface Props {
  player: Player;
  /** Left position as a percentage of the circle container */
  x: number;
  /** Top position as a percentage of the circle container */
  y: number;
  /** Angle in radians (0 = right, -π/2 = top) */
  angle: number;
  isOnline: boolean;
  isMe: boolean;
  isSelected: boolean;
  /** Whether the current viewer is the host (enables interactive styling) */
  isHostView: boolean;
  onClick: () => void;
  onRemove?: (playerId: string) => void;
}

// Half the token diameter in px — must stay in sync with --seat-size in CSS.
const TOKEN_RADIUS_PX = 28;
// Gap between the token edge and the start of the label.
const LABEL_GAP_PX = 10;

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function PlayerSeat({
  player,
  x,
  y,
  angle,
  isOnline,
  isMe,
  isSelected,
  isHostView,
  onClick,
  onRemove,
}: Props) {
  // Label is placed radially outward from the token centre.
  // --lx / --ly are picked up by .seat-label in CSS via calc().
  const labelDist = TOKEN_RADIUS_PX + LABEL_GAP_PX;
  const lx = Math.cos(angle) * labelDist;
  const ly = Math.sin(angle) * labelDist;

  const seatClasses = [
    'player-seat',
    isSelected && 'is-selected',
    isHostView && 'is-interactive',
  ]
    .filter(Boolean)
    .join(' ');

  const tokenClasses = [
    'seat-token',
    player.is_host && 'is-storyteller',
    player.is_bot && 'is-bot',
    isMe && 'is-me',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={seatClasses}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={onClick}
      // Prevent keyboard users from missing the interactive element
      role={isHostView ? 'button' : undefined}
      tabIndex={isHostView ? 0 : undefined}
      onKeyDown={isHostView ? (e) => e.key === 'Enter' && onClick() : undefined}
      aria-label={`${player.display_name}${player.is_host ? ' (Storyteller)' : ''}${isMe ? ' (You)' : ''}`}
      aria-pressed={isHostView ? isSelected : undefined}
    >
      {/*
       * ── Seat token ──────────────────────────────────────────────────
       * This is the circular player marker that will evolve into the
       * character portrait / role token in future phases.
       *
       * Space inside the token is intentionally reserved for:
       *   - Character icon / role artwork
       *   - Dead / alive visual state
       *
       * Space around the token perimeter is reserved for:
       *   - Reminder tokens (small outer rings)
       *   - Storyteller markers
       *   - Ghost vote indicator
       */}
      <div className={tokenClasses}>
        {/* Placeholder: player initials — replaced by character icon later */}
        <span className="seat-initials" aria-hidden="true">
          {getInitials(player.display_name)}
        </span>

        {/* Online presence indicator — bots are never "online" */}
        {!player.is_bot && (
          <div
            className={`seat-presence ${isOnline ? 'online' : 'offline'}`}
            title={isOnline ? 'Online' : 'Offline'}
          />
        )}

        {/*
         * Remove button — appears on the selected seat only.
         * Positioned at the token's top-right corner so it doesn't
         * interfere with the label area.
         */}
        {isSelected && !player.is_host && onRemove && (
          <button
            className="seat-remove-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(player.id);
            }}
            aria-label={`Remove ${player.display_name}`}
          >
            ✕
          </button>
        )}
      </div>

      {/*
       * ── Name label ──────────────────────────────────────────────────
       * Positioned radially outward from the token centre using CSS
       * custom properties --lx and --ly (set inline from the angle).
       * This keeps the label readable at every clock position.
       */}
      <div
        className="seat-label"
        style={
          {
            '--lx': `${lx}px`,
            '--ly': `${ly}px`,
          } as React.CSSProperties
        }
      >
        <span className={`seat-name${isMe ? ' is-me' : ''}`}>
          {player.display_name}
        </span>
        {player.is_host && (
          <span className="seat-st-badge" aria-label="Storyteller">
            ST
          </span>
        )}
        {player.is_bot && (
          <span className="seat-bot-badge" aria-label="Bot">
            BOT
          </span>
        )}
      </div>
    </div>
  );
}
