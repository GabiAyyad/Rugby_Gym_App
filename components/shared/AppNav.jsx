'use client';

// AppNav.jsx — the app's shared navigation chrome, used by both the admin
// layout (app/admin/layout.js) and the player layout (app/player/layout.js).
// Renders the team name / signed-in user + a "Sign out" button in a sticky
// top bar, and the section links (Adherence/Programs/... or Train/History/...)
// in TWO different shapes depending on screen size — see below.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from './cn';

/**
 * One nav, two shapes: a bottom tab bar on phones (where this app actually
 * lives, per CLAUDE.md's mobile-first priority) and a horizontal top bar from
 * the `md` breakpoint up, where there's room for it.
 *
 * @param {object} props
 * @param {Array<{href: string, label: string, icon: string}>} props.items The
 *   section links to render (e.g. Adherence/Programs/Exercises/Players for
 *   admins, Train/History/Squad for players).
 * @param {string} props.title Shown top-left — the team name (admin) or the
 *   signed-in player's name (player).
 * @param {string} props.subtitle A second line under the title (role, squad, position).
 * @param {{href: string, label: string}} [props.switchTo] For a player-admin:
 *   a link to hop between the admin view and their own "My training" view.
 */
export function AppNav({ items, title, subtitle, switchTo }) {
  const pathname = usePathname();
  const router = useRouter();

  /** Clears the session cookie server-side, then sends the browser to /login. */
  async function signOut() {
    await api.post('/api/auth/logout', {});
    router.replace('/login');
    router.refresh();
  }

  // A nav item is "active" if the current URL is exactly its href, or a page
  // nested under it (e.g. /admin/programs/123 still highlights "Programs").
  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Top bar: title/subtitle + (from md up) the full link row + sign out. */}
      <header className="topbar">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-ink-400">{subtitle}</p>
        </div>

        {/* .md-hidden below and .md-flex/hidden here are the CSS breakpoint
            switch (see app/globals.css): this row is invisible on phones,
            where the bottom tab bar (further down) takes over instead. */}
        <nav className="md-flex hidden" style={{ gap: '0.25rem', alignItems: 'center' }}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                background: isActive(item.href) ? 'var(--ink-800)' : 'transparent',
                color: isActive(item.href) ? 'var(--ink-50)' : 'var(--ink-400)',
                textDecoration: 'none',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {/* Only rendered for a player-admin — lets them switch between the
              admin dashboard and their own training view. */}
          {switchTo && (
            <Link
              href={switchTo.href}
              className="rounded-lg px-3 py-2 text-xs font-medium"
              style={{ border: '1px solid var(--ink-700)', color: 'var(--ink-200)', textDecoration: 'none' }}
            >
              {switchTo.label}
            </Link>
          )}
          <button type="button" onClick={signOut} className="rounded-lg px-2 py-2 text-xs text-ink-400" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </header>

      {/* Bottom tab bar: the primary navigation on phones. Fixed to the
          bottom of the viewport, hidden from md up (`.md-hidden`) where the
          top bar's link row above takes over instead. */}
      <nav className="app-nav md-hidden" style={{ position: 'fixed', insetInline: 0, bottom: 0 }}>
        <ul className="flex" style={{ width: '100%', maxWidth: '32rem', margin: '0 auto', listStyle: 'none', padding: 0 }}>
          {items.map((item) => (
            <li key={item.href} className="flex-1">
              <Link href={item.href} className={cn('app-nav-item', isActive(item.href) && 'active')}>
                <span aria-hidden className="app-nav-item-icon">
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
