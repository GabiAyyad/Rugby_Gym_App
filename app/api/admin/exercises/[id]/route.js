// Admin-only endpoint for one specific exercise library entry.
import { deleteExercise } from '@/lib/actions/deleteExercise';
import { updateExercise } from '@/lib/actions/updateExercise';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';
import { nullableString, requireEnum, requireString, requireUUID } from '@/lib/validate';

const PROGRESSION_TYPES = ['heavy_compound', 'light_compound_isolation', 'bodyweight_plyo', 'carry_loaded'];

function parseUpdateInput(body) {
  return {
    name: requireString(body.name, 'name', { min: 1, max: 80 }),
    videoUrl: nullableString(body.videoUrl, 'videoUrl'),
    movementPattern: nullableString(body.movementPattern, 'movementPattern', { max: 60 }),
    progressionType: requireEnum(body.progressionType, PROGRESSION_TYPES, 'progressionType'),
  };
}

/** PATCH { name, videoUrl?, movementPattern?, progressionType } -> the updated Exercise. */
export async function PATCH(request, context) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = await context.params;
    requireUUID(id, 'id', 'Unknown exercise.');
    const body = parseUpdateInput(await parseBody(request));
    return updateExercise(session, { ...body, id });
  });
}

/** DELETE (no body) -> { id }. Refused with 409 if any program still uses this exercise. */
export async function DELETE(_request, context) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = await context.params;
    requireUUID(id, 'id', 'Unknown exercise.');
    return deleteExercise(session, { id });
  });
}
