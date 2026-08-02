import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Player } from '../types';

interface Props {
  player: Player;
  isOnline: boolean;
  isMe: boolean;
  onRemove: (playerId: string) => void;
}

export function SortablePlayerItem({ player, isOnline, isMe, onRemove }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`player-item${isDragging ? ' dragging' : ''}`}
    >
      <div className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">
        ⠿
      </div>
      <div className={`player-presence ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online' : 'Offline'} />
      <span className="player-name">{player.display_name}</span>
      {player.is_host && <span className="player-badge host">Storyteller</span>}
      {isMe && !player.is_host && <span className="player-badge me">You</span>}
      {!player.is_host && (
        <button
          className="player-remove-btn"
          onClick={() => onRemove(player.id)}
          title={`Remove ${player.display_name}`}
        >
          Remove
        </button>
      )}
    </div>
  );
}
