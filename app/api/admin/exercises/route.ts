import { z } from 'zod';
import { createExercise } from '@/lib/actions/createExercise';
import { listExercises } from '@/lib/actions/listExercises';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';

/** An empty box means "no video", so '' is accepted and normalised to null. */
const createSchema = z.object({
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

export async function GET() {
  return handle(async () => listExercises(await requireAdmin()));
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireAdmin();
    return createExercise(session, await parseBody(request, createSchema));
  });
}
