/**
 * JSDoc mirror of db/migrations — plain JS has no compile-time types, so these
 * exist for editor intellisense and as the one place enum values are written
 * down. Keep in step with the SQL: if you change a migration, change this file
 * in the same commit.
 *
 * @typedef {'forward'|'back'} PositionGroup
 * @typedef {'heavy_compound'|'light_compound_isolation'|'bodyweight_plyo'|'carry_loaded'} ProgressionType
 *
 * @typedef {object} TeamRow
 * @property {string} id
 * @property {string} name
 * @property {string} login_code
 * @property {boolean} leaderboard_enabled
 * @property {string} created_at
 *
 * @typedef {object} PlayerRow
 * @property {string} id
 * @property {string} team_id
 * @property {string} name
 * @property {PositionGroup|null} position_group
 * @property {boolean} is_admin
 * @property {boolean} is_player
 * @property {string|null} admin_pin_hash
 * @property {boolean} leaderboard_opt_in
 * @property {string} created_at
 *
 * @typedef {object} ExerciseRow
 * @property {string} id
 * @property {string} name
 * @property {string|null} video_url
 * @property {string|null} movement_pattern
 * @property {ProgressionType} progression_type
 * @property {string} created_at
 *
 * @typedef {object} ProgramRow
 * @property {string} id
 * @property {string} team_id
 * @property {PositionGroup} position_group
 * @property {string} name
 * @property {string} start_date
 * @property {string} end_date
 * @property {boolean|null} is_active_override
 * @property {string} created_at
 *
 * @typedef {object} ProgramDayRow
 * @property {string} id
 * @property {string} program_id
 * @property {number} day_number
 * @property {string|null} label
 *
 * @typedef {object} ProgramExerciseRow
 * @property {string} id
 * @property {string} program_day_id
 * @property {string} exercise_id
 * @property {number} order
 * @property {number} target_sets
 * @property {string} target_reps
 * @property {number} rest_seconds
 * @property {string|null} notes
 *
 * @typedef {object} SessionRow
 * @property {string} id
 * @property {string} player_id
 * @property {string} program_day_id
 * @property {string} date
 * @property {string|null} completed_at
 * @property {string} created_at
 *
 * @typedef {object} LogRow
 * @property {string} id
 * @property {string} session_id
 * @property {string} program_exercise_id
 * @property {number} set_number
 * @property {number|null} reps_done
 * @property {number|null} weight_used
 * @property {string|null} distance_or_time
 * @property {string} logged_at
 */

export const POSITION_GROUPS = ['forward', 'back'];

export const PROGRESSION_TYPE_VALUES = ['heavy_compound', 'light_compound_isolation', 'bodyweight_plyo', 'carry_loaded'];
