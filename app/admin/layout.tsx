import { AppNav, type NavItem } from '@/components/shared/AppNav';
import { requireAdminPage } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ITEMS: NavItem[] = [
  { href: '/admin/dashboard', label: 'Adherence', icon: '📊' },
  { href: '/admin/programs', label: 'Programs', icon: '🗓️' },
  { href: '/admin/exercises', label: 'Exercises', icon: '🏋️' },
  { href: '/admin/players', label: 'Players', icon: '👥' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminPage();

  return (
    <div className="min-h-dvh">
      <AppNav
        items={ITEMS}
        title={session.teamName}
        subtitle={`${session.name} · Admin`}
        switchTo={session.isPlayer ? { href: '/player/today', label: 'My training' } : undefined}
      />
      <main className="mx-auto max-w-5xl px-4 pt-5 pb-24 md:pb-10">{children}</main>
    </div>
  );
}
