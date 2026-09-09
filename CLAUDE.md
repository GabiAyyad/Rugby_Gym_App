# Rugby Team Training App — Project Spec (JS / PostgreSQL edition)

## Overview
A mobile-responsive web app for managing gym training programs for a rugby team, across two squads: **Palestine** and **Cyprus**. Admins build monthly training blocks split by position group (Forwards vs Backs); players log their workouts (weights, reps, sets) each session. The app tracks adherence (who's training and who isn't) and gives smart, per-exercise progression suggestions.

This is a plain-JavaScript, plain-CSS, direct-PostgreSQL port of the original TypeScript/Supabase/Tailwind app that lives alongside this one (`../Rugby-Training`). Same product spec, same folder shape, same domain rules — different plumbing. See `README.md` for the exact swap table.

**Priority**: fast to build, trivial to deploy, low ongoing maintenance. No native app — mobile-first responsive web only. Unlike the original, this edition talks to PostgreSQL directly (via `pg`) rather than through Supabase, so it works against any Postgres host — but that means *you* choose and provision the database (local, Railway, Render, Neon, RDS, ...); there is no managed dashboard bundled in.

---

## Tech Stack
- **Frontend + API**: Next.js (App Router, JavaScript)
- **Database**: PostgreSQL, any host, accessed directly via `pg` (node-postgres) — no ORM
- **Auth**: no third-party provider — team code + roster name + admin PIN, session signed into an httpOnly cookie with `jose`
- **Styling**: plain hand-written CSS (`app/globals.css` for design tokens and utilities, `styles/components.css` for shared component classes) — no Tailwind, no CSS-in-JS
- **Deployment**: Vercel — connect the GitHub repo, every push to `main` auto-deploys; the database lives wherever you provisioned it in step 1 of `SETUP.md`
- **IDE**: VS Code with the Claude Code extension

---

## Structural Principles

Kept identical to the original app's principles, just without TypeScript's compile-time enforcement:

- **One function per action**, not generic CRUD handlers. Each distinct action (`createPlayer`, `listPrograms`, `logSet`, `getAdherenceDashboard`) lives in its own clearly named file in `lib/actions/`.
- **Shared shapes** documented as JSDoc typedefs in a `types/` folder — same intent as the original's TypeScript interfaces, but documentation-only (no compiler check, so keep them honest by hand).
- **Feature-based folders**, not type-based.
- **Domain logic separated from data access** — business rules (progression logic, adherence calculation, active-program resolution) live in plain functions in `lib/domain/` that take data in and return data out, independent of how that data was fetched. This keeps them testable without a database, and they are: see `lib/domain/*.test.js`.

---

## Project Structure

```
/app
  /admin
    /dashboard          → adherence dashboard page
    /players             → players list + form
    /exercises            → exercises list + form
    /programs               → program builder (program → days → exercises)
  /player
    /today               → today's scheduled session
    /log/[sessionId]        → exercise logging flow + rest timer
    /history               → past logs + progress chart
  /login                 → team code + name selection
  /api
    /admin
      /players            → GET/POST, [id] PATCH/DELETE
      /exercises           → GET/POST, [id] PATCH/DELETE
      /programs             → GET/POST, [id] GET/PATCH/DELETE, [id]/duplicate POST
      /dashboard             → GET adherence dashboard
      /team/leaderboard       → PATCH team leaderboard switch
    /player
      /session              → POST startSession, [sessionId] GET, [sessionId]/complete POST
      /log/last               → GET getLastLogForExercise
      /history                 → GET getPlayerHistory
      /leaderboard              → GET, /opt-in PATCH
      /sync                      → POST syncLogs (offline queue replay)
      /week                       → GET getWeekView

/lib
  /actions                 → one file per action, e.g. createPlayer.js, logSet.js
  /domain                  → pure business logic, no DB calls
    progression.js         → suggestNextWeight(progressionType, lastLog) → per-type rules
    adherence.js            → calculateAdherence(scheduledSessions, loggedSessions)
    activeProgram.js         → resolveActiveProgram(programs, date)
    week.js                   → date maths, all as 'YYYY-MM-DD' strings
    repRange.js                 → parses free-text targets like "8-10", "40m"
  /db
    pool.js                 → pg.Pool + Postgres type parser overrides
    errors.js                → DataError + isUniqueViolation/isForeignKeyViolation
    helpers.js                → one/many/run query wrappers, valuesList bulk-insert builder
    queries/                   → raw SQL, one module per feature area
  auth.js, session.js, pin.js, http.js, api.js, env.js, validate.js
  /offline
    queue.js                 → IndexedDB-backed local write queue
    useOfflineSync.js          → background flush hook

/types                      → JSDoc typedefs only (documentation, not enforced)
  common.js, database.js, player.js, exercise.js, program.js, session.js

/components
  /admin                  → PlayerForm, ExerciseForm, ProgramBuilder, AdherenceTable
  /player                 → SessionRunner, ExerciseStep, RestTimer, ProgressChart
  /shared                 → Button, Input, Select, ConfirmDialog, EmptyState, LoadingState, AppNav

/db
  migrations/               → plain SQL migration files, applied by scripts/migrate.mjs
  seed.sql                  → the two squads + starting exercise library

/scripts
  migrate.mjs               → applies db/migrations/ in order, tracked in schema_migrations
  seed.mjs                  → loads db/seed.sql
  check-connection.mjs       → preflight: env vars set, DB reachable, schema + seed present
```

---

## Data Model (Postgres)

Identical to the original — see `db/migrations/001_init.sql` for the exact
`CREATE TABLE` statements. Summary:

### `teams`
- `id`, `name` (e.g. "Palestine", "Cyprus"), `login_code` (unique), `leaderboard_enabled`

### `players`
- `id`, `team_id` (FK), `name`, `position_group` (enum: `forward` | `back`, nullable), `is_admin` (bool), `is_player` (bool), `admin_pin_hash`, `leaderboard_opt_in`, `created_at`

### `exercises`
- `id`, `name`, `video_url` (nullable), `movement_pattern` (nullable), `progression_type` (enum: `heavy_compound` | `light_compound_isolation` | `bodyweight_plyo` | `carry_loaded`), `created_at`

> `exercises` is global, shared across both teams — only the *program* built from them is team-specific.

### `programs`
- `id`, `team_id` (FK), `position_group` (enum), `name`, `start_date`, `end_date`, `is_active_override` (nullable bool), `created_at`

### `program_days`
- `id`, `program_id` (FK), `day_number` (1–4), `label` (nullable)

### `program_exercises`
- `id`, `program_day_id` (FK), `exercise_id` (FK), `order`, `target_sets`, `target_reps` (string, supports ranges like "8-10"), `rest_seconds`, `notes` (nullable)

### `sessions`
- `id`, `player_id` (FK), `program_day_id` (FK), `date`, `completed_at` (nullable)

### `logs`
- `id`, `session_id` (FK), `program_exercise_id` (FK), `set_number`, `reps_done`, `weight_used` (nullable decimal), `distance_or_time` (nullable), `logged_at`

> `logs` is the core table — attendance, adherence, and progress are all derived from whether `logs` rows exist for a player on a given scheduled day.

---

## Multi-Tenancy (Team Isolation)

- Every `players` and `programs` row carries a mandatory `team_id`.
- There is **no RLS** in this edition (see `docs/ARCHITECTURE.md` for why that's an acceptable trade-off here: the Postgres credential is never exposed to a browser at all). Isolation is enforced entirely in `lib/actions` — every query that touches `players` or `programs` filters on `session.teamId`.
- `exercises` has no `team_id` — it's shared globally on purpose.
- Players cannot transfer between teams (no update path exposed for `team_id` on `players` from the player side; admin-only, and only via explicit reassignment).

---

## Roles & Auth

**Login flow**: enter team code → select player name from that team's roster (or "I'm Admin", gated by a PIN). No email/password, no magic links — this needs to work reliably for ~40 players.

- Roles are **two independent booleans** on `players`, not mutually exclusive: `is_admin`, `is_player`.
- A player-admin (e.g. team captain) gets `is_admin: true, is_player: true` — lands on the admin dashboard by default, with a toggle to switch into "My Training" (identical to the normal player experience).
- Pure admin/coach who doesn't train: `is_admin: true, is_player: false`.
- Normal player: `is_admin: false, is_player: true`.
- Session state (team_id, player_id, is_admin, is_player) is established server-side on login and stored in a secure httpOnly cookie — never trust role flags sent from the client on subsequent requests.

---

## Position-Based Programming, Periodization, Progression Logic

Identical rules to the original — see `lib/domain/progression.js`,
`lib/domain/activeProgram.js`, and the domain notes in `docs/ARCHITECTURE.md`.
Forwards get heavy compound lifts and low rep ranges; Backs get Olympic/plyo
work and higher rep accessory work. Blocks run 4 weeks and switch over
automatically based on `start_date`/`end_date`, with `is_active_override` as
the manual escape hatch.

---

## Offline Support (In Scope)
Gym wifi/signal is often unreliable. Player-side logging works offline and syncs once connectivity returns — local-first writes via IndexedDB (`lib/offline/queue.js`) with background sync of `sessions`/`logs` to Postgres once connection resumes (`lib/offline/useOfflineSync.js`, `POST /api/player/sync`).

---

## Explicitly Out of Scope (v1)
- Native mobile app (web only, mobile-responsive)
- Injury/exemption tracking UI
- Cross-team visibility of any kind
- Email/password auth or magic links
- A managed database dashboard — you own provisioning and backups for whatever Postgres you point `DATABASE_URL` at

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
