import { redirect } from 'next/navigation';
import { landingPath } from '@/lib/auth';
import { readSession } from '@/lib/session';

export default async function Home() {
  const session = await readSession();
  redirect(session ? landingPath(session) : '/login');
}
