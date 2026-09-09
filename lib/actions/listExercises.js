import 'server-only';
import { listExerciseRows } from '@/lib/db/queries/exercises';

/** Row -> contract. Shared with the sibling exercise actions. */
export function toExercise(row) {
  return {
    id: row.id,
    name: row.name,
    videoUrl: row.video_url,
    movementPattern: row.movement_pattern,
    progressionType: row.progression_type,
    createdAt: row.created_at,
  };
}

/**
 * The library is one global list shared by both squads (CLAUDE.md), so there is
 * nothing to scope by team here. The session argument stays for the uniform
 * action signature and because reading the library still requires a caller.
 *
 * ~40 rows in practice: fetched whole, filtered in the browser.
 */
/** Every exercise in the global library (not scoped to a team — see the note above). */
export async function listExercises(session) {
  void session;
  const rows = await listExerciseRows();
  return { exercises: rows.map(toExercise) };
}
