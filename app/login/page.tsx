import { redirect } from 'next/navigation';
import { LoginFlow } from '@/components/auth/LoginFlow';
import { landingPath } from '@/lib/auth';
import { readSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect(landingPath(session));

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <LoginFlow />
    </main>
  );
}
