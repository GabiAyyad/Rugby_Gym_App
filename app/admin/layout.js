// Shared shell for every page under /admin/*. Guards the whole subtree with
// requireAdminPage() — a non-admin (or signed-out) visitor is redirected away
// before any admin page's own code runs — then renders the top/bottom nav
// around whichever admin page matched the URL (`children`).
import { AppNav } from '@/components/shared/AppNav';
import { requireAdminPage } from '@/lib/auth';

// Always re-run server-side (never statically cached) since the guard above
// depends on the request's session cookie.
export const dynamic = 'force-dynamic';

// The four admin tabs, in the order they appear in both the top bar (desktop)
// and bottom bar (phone) rendered by AppNav.
const ITEMS = [
  { href: '/admin/dashboard', label: 'Adherence', icon: '📊' },
  { href: '/admin/programs', label: 'Programs', icon: '🗓️' },
  { href: '/admin/exercises', label: 'Exercises', icon: '🏋️' },
  { href: '/admin/players', label: 'Players', icon: '👥' },
];

export default async function AdminLayout({ children }) {
  // Redirects to /player/today if not an admin, or to /login if not signed in.
  const session = await requireAdminPage();

  return (
    <div style={{ minHeight: '100dvh' }}>
      <AppNav items={ITEMS} title={session.teamName} subtitle={`${session.name} · Admin`} switchTo={session.isPlayer ? { href: '/player/today', label: 'My training' } : undefined} />
      <main className="container" style={{ paddingTop: '1.25rem', paddingBottom: '6rem' }}>
        {children}
      </main>
    </div>
  );
}
