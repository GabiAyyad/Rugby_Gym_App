// Shared shell for every page under /player/*. Guards the subtree with
// requirePlayerPage() (redirects a non-player, or a signed-out visitor, away)
// then renders the nav around whichever player page matched the URL.
import { AppNav } from '@/components/shared/AppNav';
import { requirePlayerPage } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// The three player tabs, in nav order.
const ITEMS = [
  { href: '/player/today', label: 'Train', icon: '🏉' },
  { href: '/player/history', label: 'History', icon: '📈' },
  { href: '/player/leaderboard', label: 'Squad', icon: '🏆' },
];

export default async function PlayerLayout({ children }) {
  // Redirects to /admin/dashboard if not a player, or to /login if not signed in.
  const session = await requirePlayerPage();
  const position = session.positionGroup === 'forward' ? 'Forwards' : 'Backs';

  return (
    <div style={{ minHeight: '100dvh' }}>
      <AppNav items={ITEMS} title={session.name} subtitle={`${session.teamName} · ${position}`} switchTo={session.isAdmin ? { href: '/admin/dashboard', label: 'Admin' } : undefined} />
      <main className="container" style={{ maxWidth: '48rem', paddingTop: '1.25rem', paddingBottom: '6rem' }}>
        {children}
      </main>
    </div>
  );
}
