// Admin-only collection endpoint for the shared exercise library (global,
// not scoped to a team — both squads read and write the same list).
import { createExercise } from '@/lib/actions/createExercise';
import { listExercises } from '@/lib/actions/listExercises';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';
import { nullableString, requireEnum, requireString } from '@/lib/validate';

const PROGRESSION_TYPES = ['heavy_compound', 'light_compound_isolation', 'bodyweight_plyo', 'carry_loaded'];

/** An empty box means "no video"; normaliseExercise (the action) validates the URL shape. */
function parseCreateInput(body) {
  return {
    name: requireString(body.name, 'name', { min: 1, max: 80 }),
    videoUrl: nullableString(body.videoUrl, 'videoUrl'),
    movementPattern: nullableString(body.movementPattern, 'movementPattern', { max: 60 }),
    progressionType: requireEnum(body.progressionType, PROGRESSION_TYPES, 'progressionType'),
  };
}

/** GET -> the full exercise library. */
export async function GET() {
  return handle(async () => listExercises(await requireAdmin()));
}

/** POST { name, videoUrl?, movementPattern?, progressionType } -> the new Exercise. */
export async function POST(request) {
  return handle(async () => {
    const session = await requireAdmin();
    return createExercise(session, parseCreateInput(await parseBody(request)));
  });
}
