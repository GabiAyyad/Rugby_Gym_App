// Public login screen: team code -> pick your name -> (admins only) PIN.
// All the actual step logic lives in the client component <LoginFlow>; this
// server component's only job is to bounce an already-signed-in visitor
// straight to their landing page instead of showing them the form again.
import { redirect } from 'next/navigation';
import { LoginFlow } from '@/components/auth/LoginFlow';
import { landingPath } from '@/lib/auth';
import { readSession } from '@/lib/session';

// Opt out of static caching — this page's redirect decision depends on the
// request's session cookie, so it must run fresh on every request.
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect(landingPath(session));

  return (
    <main className="flex items-center justify-center" style={{ minHeight: '100dvh', padding: '2.5rem 1.25rem' }}>
      <LoginFlow />
    </main>
  );
}
