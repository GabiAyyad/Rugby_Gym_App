// The bare "/" route. It never renders anything itself — it just reads the
// session cookie and redirects: signed-in users go to their landing page
// (admin dashboard or player "today" screen), everyone else goes to /login.
import { redirect } from 'next/navigation';
import { landingPath } from '@/lib/auth';
import { readSession } from '@/lib/session';

export default async function Home() {
  const session = await readSession();
  redirect(session ? landingPath(session) : '/login');
}
