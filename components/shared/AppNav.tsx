'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from './cn';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

/**
 * One nav, two shapes: a bottom bar on phones (where this app actually lives)
 * and a top bar from md up.
 */
export function AppNav({
  items,
  title,
  subtitle,
  switchTo,
}: {
  items: NavItem[];
  title: string;
  subtitle: string;
  /** Shown for player-admins so they can hop between the two experiences. */
  switchTo?: { href: string; label: string };
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await api.post('/api/auth/logout', {});
    router.replace('/login');
    router.refresh();
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="truncate text-xs text-ink-400">{subtitle}</p>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive(item.href)
                    ? 'bg-ink-800 text-ink-50'
                    : 'text-ink-400 hover:bg-ink-850 hover:text-ink-50',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {switchTo && (
              <Link
                href={switchTo.href}
                className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-200 hover:bg-ink-850"
              >
                {switchTo.label}
              </Link>
            )}
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg px-2 py-1.5 text-xs text-ink-400 hover:bg-ink-850 hover:text-ink-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-800 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-lg">
          {items.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-0.5 text-[0.7rem] transition-colors',
                  isActive(item.href) ? 'text-pitch-400' : 'text-ink-400',
                )}
              >
                <span aria-hidden className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
