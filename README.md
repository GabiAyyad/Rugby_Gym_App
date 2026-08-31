# Rugby Strength

Gym training management for a rugby team across two squads — **Palestine** and
**Cyprus**. Coaches build monthly training blocks split by position group;
players log every set from their phone, in the gym, with or without signal.

- **Setup:** [SETUP.md](SETUP.md) — Supabase, environment variables, Vercel
- **How it is put together:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **What it is meant to do:** [CLAUDE.md](CLAUDE.md)

## What it does

**For coaches**
- Adherence dashboard: who trained this week, who has gone quiet, sorted so the
  people falling behind are at the top
- Program builder: 4-week blocks, separate for Forwards and Backs, four training
  days each, duplicated forward month to month
- Player and exercise management, with a shared exercise library

**For players**
- The week's four sessions; train the next unfinished one, or pick any of them
- Set-by-set logging with weight and rep suggestions based on what you did last
  time, an auto-starting rest timer, and embedded technique video
- Session history and a weight-over-time chart per exercise
- Optional squad leaderboard, opt-in, never across teams

Logging works offline. Sets go into a local queue and sync when signal returns;
replay is idempotent, so nothing duplicates.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase
(Postgres) · Vercel. No Docker, no self-hosted database, no server to maintain.

## Development

```bash
npm install
cp .env.example .env.local   # fill in — see SETUP.md
npm run dev
```

```bash
npm run check:db     # preflight: env vars, Supabase reachable, schema pushed, seed loaded
npm run test         # domain logic unit tests
npm run test:schema  # applies the migrations to an in-process Postgres and asserts the constraints
npm run typecheck    # tsc --noEmit
npm run lint
npm run build
```

The business rules — progression suggestions, adherence, which block is live —
are pure functions in `lib/domain/` with no database access, and are covered by
`npm run test`.
