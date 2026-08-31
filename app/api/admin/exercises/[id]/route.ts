import { z } from 'zod';
import { deleteExercise } from '@/lib/actions/deleteExercise';
import { updateExercise } from '@/lib/actions/updateExercise';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';

type RouteContext = { params: Promise<{ id: string }> };

const paramsSchema = z.object({ id: z.uuid('Unknown exercise.') });

const updateSchema = z.object({
  name: z.string().min(1, 'Enter an exercise name.').max(80, 'That name is too long.'),
  videoUrl: z
    .union([z.url('Enter a full link, e.g. https://youtu.be/...'), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  movementPattern: z
    .union([z.string().max(60), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  progressionType: z.enum([
    'heavy_compound',
    'light_compound_isolation',
    'bodyweight_plyo',
    'carry_loaded',
  ]),
});

export async function PATCH(request: Request, context: RouteContext) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = paramsSchema.parse(await context.params);
    const body = await parseBody(request, updateSchema);
    return updateExercise(session, { ...body, id });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = paramsSchema.parse(await context.params);
    return deleteExercise(session, { id });
  });
}
