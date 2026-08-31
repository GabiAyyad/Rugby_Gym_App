import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';
import { isISODate } from '@/lib/domain/week';
import { createProgram } from '@/lib/actions/createProgram';
import { listPrograms } from '@/lib/actions/listPrograms';

const isoDate = z.string().refine(isISODate, 'Use a YYYY-MM-DD date.');

const exerciseSchema = z.object({
  exerciseId: z.uuid(),
  order: z.number().int().min(1),
  targetSets: z.number().int().min(1, 'At least one set.').max(20),
  targetReps: z.string().trim().min(1, 'Set a target.').max(40),
  restSeconds: z.number().int().min(0, 'Rest cannot be negative.').max(3600),
  notes: z.string().trim().max(500).nullable(),
});

const daySchema = z.object({
  dayNumber: z.number().int().min(1).max(4),
  label: z.string().trim().max(60).nullable(),
  exercises: z.array(exerciseSchema).max(30),
});

const createSchema = z.object({
  positionGroup: z.enum(['forward', 'back']),
  name: z.string().trim().min(1, 'Give the block a name.').max(80),
  startDate: isoDate,
  endDate: isoDate,
  isActiveOverride: z.boolean().nullable(),
  days: z.array(daySchema).min(1, 'A block needs at least one day.').max(4),
});

export async function GET() {
  return handle(async () => {
    const session = await requireAdmin();
    return listPrograms(session);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireAdmin();
    const input = await parseBody(request, createSchema);
    return createProgram(session, input);
  });
}
