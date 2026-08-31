import { z } from 'zod';
import { login } from '@/lib/actions/login';
import { handle, parseBody } from '@/lib/http';

const schema = z.object({
  loginCode: z.string().min(1),
  playerId: z.uuid(),
  pin: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, schema);
    const { redirectTo } = await login(input);
    return { redirectTo };
  });
}
