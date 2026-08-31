import { z } from 'zod';
import { bootstrapAdmin } from '@/lib/actions/bootstrapAdmin';
import { handle, parseBody } from '@/lib/http';

const schema = z.object({
  loginCode: z.string().min(1),
  name: z.string().min(2, 'Enter your name.'),
  pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4-8 digits.'),
});

export async function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, schema);
    return bootstrapAdmin(input);
  });
}
