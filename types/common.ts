/** Shapes shared across features. */

export type ISODate = string; // 'YYYY-MM-DD'

/** Every API route returns this envelope. See lib/http.ts. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export interface SessionUser {
  playerId: string;
  teamId: string;
  teamName: string;
  name: string;
  isAdmin: boolean;
  isPlayer: boolean;
  positionGroup: import('./database').PositionGroup | null;
}
