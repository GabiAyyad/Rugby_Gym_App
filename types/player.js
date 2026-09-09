/**
 * @typedef {object} Player
 * @property {string} id
 * @property {string} teamId
 * @property {string} name
 * @property {import('./database').PositionGroup|null} positionGroup
 * @property {boolean} isAdmin
 * @property {boolean} isPlayer
 * @property {boolean} hasAdminPin
 * @property {boolean} leaderboardOptIn
 * @property {string} createdAt
 *
 * @typedef {object} CreatePlayerInput
 * @property {string} name
 * @property {import('./database').PositionGroup|null} positionGroup
 * @property {boolean} isAdmin
 * @property {boolean} isPlayer
 * @property {string|null} [adminPin] Required when isAdmin is true. 4-8 digits.
 */
export {};
