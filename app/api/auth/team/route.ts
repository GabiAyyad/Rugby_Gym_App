import { z } from 'zod';
import { lookupTeam } from '@/lib/actions/lookupTeam';
import { handle, parseBody } from '@/lib/http';

const schema = z.object({ loginCode: z.string().min(1, 'Enter your team code.') });

export async function POST(request: Request) {
  return handle(async () => {
    const { loginCode } = await parseBody(request, schema);
    return lookupTeam(loginCode);
  });
}
