import { GrimoireSeat } from './GrimoireSeat';
import { TROUBLE_BREWING } from '../data/troubleBrewing';
import { TOKEN_BY_KEY } from '../data/reminderTokens';
import type { Player, Room, ReminderToken } from '../types';

const RADIUS_PCT = 38;

interface Props {
  players: Player[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  room: Room;
  onPhaseChange: (phase: string) => void;
  reminderTokens: ReminderToken[];
}

// "Night 1" → "Day 1" → "Night 2" → "Day 2" → …
function nextPhase(phase: string): string {
  const m = phase.match(/^(Night|Day) (\d+)$/);
  if (!m) return phase;
  return m[1] === 'Night' ? `Day ${m[2]}` : `Night ${parseInt(m[2]) + 1}`;
}

function prevPhase(phase: string): string {
  const m = phase.match(/^(Night|Day) (\d+)$/);
  if (!m) return phase;
  if (m[1] === 'Day') return `Night ${m[2]}`;
  if (parseInt(m[2]) <= 1) return phase;
  return `Day ${parseInt(m[2]) - 1}`;
}

export function GrimoireCircle({
  players,
  selectedId,
  onSelect,
  room,
  onPhaseChange,
  reminderTokens,
}: Props) {
  const seats = players.filter((p) => !p.is_host);
  const n = seats.length;
  const ringSize = RADIUS_PCT * 2;
  const ringOffset = 50 - RADIUS_PCT;
  const aliveCount = seats.filter((p) => p.is_alive).length;
  const isNight = room.phase.startsWith('Night');

  return (
    <div className="seating-wrapper">
      <div className={`seating-circle grimoire-circle${isNight ? ' grimoire-night' : ' grimoire-day'}`}>
        {/* Subtle guide ring */}
        <div
          className="seating-ring"
          style={{
            left: `${ringOffset}%`,
            top: `${ringOffset}%`,
            width: `${ringSize}%`,
            height: `${ringSize}%`,
          }}
        />

        {/*
         * ── Centre panel ──────────────────────────────────────────────
         * Room info + phase navigation.
         * Space reserved for Night Assistant controls in a later phase.
         */}
        <div className="grimoire-center">
          <div className="grimoire-center-code">{room.code}</div>
          <div className="grimoire-center-count">
            {aliveCount} / {n} alive
          </div>
          <div className="grimoire-phase-row">
            <button
              className="grimoire-phase-btn"
              onClick={() => onPhaseChange(prevPhase(room.phase))}
              aria-label="Previous phase"
              title="Previous phase"
            >
              ‹
            </button>
            <span className={`grimoire-phase-text${isNight ? ' phase-night' : ' phase-day'}`}>
              {room.phase}
            </span>
            <button
              className="grimoire-phase-btn"
              onClick={() => onPhaseChange(nextPhase(room.phase))}
              aria-label="Next phase"
              title="Next phase"
            >
              ›
            </button>
          </div>
        </div>

        {/* Player seats */}
        {seats.map((player, i) => {
          const angle = (2 * Math.PI * i) / n - Math.PI / 2;
          const x = 50 + RADIUS_PCT * Math.cos(angle);
          const y = 50 + RADIUS_PCT * Math.sin(angle);
          const character = player.role
            ? (TROUBLE_BREWING.find((c) => c.id === player.role) ?? null)
            : null;

          // Resolve this player's reminder tokens to display tokens
          const seatTokens = reminderTokens
            .filter((t) => t.player_id === player.id)
            .map((t) => {
              const def = TOKEN_BY_KEY.get(t.token_key);
              return def ? { id: t.id, label: def.label, color: def.color } : null;
            })
            .filter((t): t is { id: string; label: string; color: string } => t !== null);

          return (
            <GrimoireSeat
              key={player.id}
              player={player}
              character={character}
              x={x}
              y={y}
              angle={angle}
              isSelected={player.id === selectedId}
              tokens={seatTokens}
              onClick={() => onSelect(player.id === selectedId ? null : player.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
