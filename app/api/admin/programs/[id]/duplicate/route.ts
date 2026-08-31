import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { handle, parseBody } from '@/lib/http';
import { isISODate } from '@/lib/domain/week';
import { duplicateProgram } from '@/lib/actions/duplicateProgram';

const schema = z.object({
  name: z.string().trim().max(80).nullable().optional(),
  startDate: z
    .string()
    .refine(isISODate, 'Use a YYYY-MM-DD date.')
    .nullable()
    .optional(),
});

const paramsSchema = z.object({ id: z.uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin();
    const { id } = paramsSchema.parse(await params);
    const input = await parseBody(request, schema);
    return duplicateProgram(session, { id, ...input });
  });
}
