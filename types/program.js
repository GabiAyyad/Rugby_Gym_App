/**
 * @typedef {object} ProgramExercise
 * @property {string} id
 * @property {string} exerciseId
 * @property {import('./exercise').Exercise} exercise
 * @property {number} order
 * @property {number} targetSets
 * @property {string} targetReps
 * @property {number} restSeconds
 * @property {string|null} notes
 *
 * @typedef {object} ProgramDay
 * @property {string} id
 * @property {number} dayNumber
 * @property {string|null} label
 * @property {ProgramExercise[]} exercises
 *
 * @typedef {object} ProgramSummary
 * @property {string} id
 * @property {string} teamId
 * @property {import('./database').PositionGroup} positionGroup
 * @property {string} name
 * @property {import('./common').ISODate} startDate
 * @property {import('./common').ISODate} endDate
 * @property {boolean|null} isActiveOverride
 * @property {boolean} isActive Derived by resolveActiveProgram for today's date.
 * @property {number} dayCount
 * @property {number} exerciseCount
 * @property {string} createdAt
 */
export {};
