import { AppNav, type NavItem } from '@/components/shared/AppNav';
import { requirePlayerPage } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ITEMS: NavItem[] = [
  { href: '/player/today', label: 'Train', icon: '🏉' },
  { href: '/player/history', label: 'History', icon: '📈' },
  { href: '/player/leaderboard', label: 'Squad', icon: '🏆' },
];

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePlayerPage();
  const position = session.positionGroup === 'forward' ? 'Forwards' : 'Backs';

  return (
    <div className="min-h-dvh">
      <AppNav
        items={ITEMS}
        title={session.name}
        subtitle={`${session.teamName} · ${position}`}
        switchTo={session.isAdmin ? { href: '/admin/dashboard', label: 'Admin' } : undefined}
      />
      <main className="mx-auto max-w-3xl px-4 pt-5 pb-24 md:pb-10">{children}</main>
    </div>
  );
}
