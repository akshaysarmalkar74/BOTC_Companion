import { useState } from 'react';
import { PlayerSeat } from './PlayerSeat';
import type { Player } from '../types';

// Percentage of the container width/height used as the seating radius.
// Seats are positioned on the circumference of a circle with this radius.
const RADIUS_PCT = 38;

interface Props {
  players: Player[];
  onlineIds: Set<string>;
  myPlayerId: string;
  isHost: boolean;
  onSwap?: (playerIdA: string, playerIdB: string) => void;
  onRemove?: (playerId: string) => void;
}

export function CircularSeating({
  players,
  onlineIds,
  myPlayerId,
  isHost,
  onSwap,
  onRemove,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSeatClick = (playerId: string) => {
    if (!isHost) return;

    if (selectedId === null) {
      // Select this seat
      setSelectedId(playerId);
    } else if (selectedId === playerId) {
      // Clicking the already-selected seat deselects it
      setSelectedId(null);
    } else {
      // Clicking a different seat triggers a swap
      onSwap?.(selectedId, playerId);
      setSelectedId(null);
    }
  };

  const ringSize = RADIUS_PCT * 2;
  const ringOffset = 50 - RADIUS_PCT;

  // The Storyteller is not a player — exclude them from the circle.
  const seats = players.filter((p) => !p.is_host);

  return (
    <div className="seating-wrapper">
      <div className="seating-circle">
        {/* Subtle guide ring showing where seats are positioned */}
        <div
          className="seating-ring"
          style={{
            left: `${ringOffset}%`,
            top: `${ringOffset}%`,
            width: `${ringSize}%`,
            height: `${ringSize}%`,
          }}
        />

        {seats.map((player, i) => {
          // Distribute seats evenly; start at the top (−π/2)
          const angle = (2 * Math.PI * i) / seats.length - Math.PI / 2;
          const x = 50 + RADIUS_PCT * Math.cos(angle);
          const y = 50 + RADIUS_PCT * Math.sin(angle);

          return (
            <PlayerSeat
              key={player.id}
              player={player}
              x={x}
              y={y}
              angle={angle}
              isOnline={onlineIds.has(player.id)}
              isMe={player.id === myPlayerId}
              isSelected={selectedId === player.id}
              isHostView={isHost}
              onClick={() => handleSeatClick(player.id)}
              onRemove={isHost ? onRemove : undefined}
            />
          );
        })}
      </div>

      {/* Contextual hint for the host */}
      {isHost && seats.length > 1 && (
        <p className="seating-hint">
          {selectedId
            ? 'Click another seat to swap — or click the same seat to cancel'
            : 'Click any seat to select, then click another to swap positions'}
        </p>
      )}
    </div>
  );
}
