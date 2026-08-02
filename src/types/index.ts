export interface Room {
  id: string;
  code: string;
  host_id: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  display_name: string;
  is_host: boolean;
  seat_order: number;
  created_at: string;
}

export interface Session {
  playerId: string;
  roomId: string;
  isHost: boolean;
}
