import 'server-only';
import { many, one } from '@/lib/db/helpers';

/**
 * The exercise library is global on purpose (CLAUDE.md): both squads pick from
 * the same list, only the programs built from it are team-specific. So unlike
 * players.js, nothing here takes or filters on a team_id.
 */

/** Every exercise in the library, alphabetical by name. */
export async function listExerciseRows() {
  return many('select * from exercises order by name');
}

/** One exercise by id, or null if it doesn't exist. */
export async function findExerciseRow(exerciseId) {
  return one('select * from exercises where id = $1', [exerciseId]);
}

/** Adds a new exercise to the library. */
export async function insertExerciseRow(write) {
  return one(
    `insert into exercises (name, video_url, movement_pattern, progression_type)
     values ($1, $2, $3, $4)
     returning *`,
    [write.name, write.videoUrl, write.movementPattern, write.progressionType],
  );
}

/** Overwrites every editable field on one exercise. Returns null if the id doesn't exist. */
export async function updateExerciseRow(exerciseId, write) {
  return one(
    `update exercises
        set name = $2, video_url = $3, movement_pattern = $4, progression_type = $5
      where id = $1
      returning *`,
    [exerciseId, write.name, write.videoUrl, write.movementPattern, write.progressionType],
  );
}

/** Removes one exercise. Fails at the database level (FK restrict) if any program still uses it. */
export async function deleteExerciseRow(exerciseId) {
  return one('delete from exercises where id = $1 returning *', [exerciseId]);
}

/**
 * Which programs reference this exercise. `program_exercises.exercise_id` is
 * `on delete restrict`, so a delete would fail anyway — this exists so the user
 * gets "used in 3 programs" instead of a bare foreign-key error.
 */
export async function findProgramIdsUsingExercise(exerciseId) {
  const rows = await many(
    `select distinct pd.program_id
       from program_exercises pe
       join program_days pd on pd.id = pe.program_day_id
      where pe.exercise_id = $1`,
    [exerciseId],
  );
  return rows.map((row) => row.program_id);
}
