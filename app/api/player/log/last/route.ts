import { z } from 'zod';
import { getLastLogForExercise } from '@/lib/actions/getLastLogForExercise';
import { requirePlayer } from '@/lib/auth';
import { handle, parseQuery } from '@/lib/http';

const schema = z.object({ programExerciseId: z.uuid() });

export async function GET(request: Request) {
  return handle(async () => {
    const session = await requirePlayer();
    const { programExerciseId } = parseQuery(request, schema);
    return getLastLogForExercise(session, programExerciseId);
  });
}
