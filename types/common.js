/**
 * @typedef {string} ISODate 'YYYY-MM-DD'
 *
 * @typedef {{ok: true, data: any}|{ok: false, error: string, fieldErrors?: Record<string,string>}} ApiResult
 * Every API route returns this envelope. See lib/http.js.
 *
 * @typedef {object} SessionUser
 * @property {string} playerId
 * @property {string} teamId
 * @property {string} teamName
 * @property {string} name
 * @property {boolean} isAdmin
 * @property {boolean} isPlayer
 * @property {import('./database').PositionGroup|null} positionGroup
 */
export {};
