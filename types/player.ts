import type { PositionGroup } from './database';

export interface Player {
  id: string;
  teamId: string;
  name: string;
  positionGroup: PositionGroup | null;
  isAdmin: boolean;
  isPlayer: boolean;
  hasAdminPin: boolean;
  leaderboardOptIn: boolean;
  createdAt: string;
}

export interface CreatePlayerInput {
  name: string;
  positionGroup: PositionGroup | null;
  isAdmin: boolean;
  isPlayer: boolean;
  /** Required when isAdmin is true. 4–8 digits. */
  adminPin?: string | null;
}

export interface UpdatePlayerInput extends CreatePlayerInput {
  id: string;
  /** Omit to leave an existing PIN untouched. */
  adminPin?: string | null;
}

export interface DeletePlayerInput {
  id: string;
}

export interface ListPlayersResult {
  players: Player[];
}
