# Rugby Team Training App — Project Spec

## Overview
A mobile-responsive web app for managing gym training programs for a rugby team, across two squads: **Palestine** and **Cyprus**. Admins build monthly training blocks split by position group (Forwards vs Backs); players log their workouts (weights, reps, sets) each session. The app tracks adherence (who's training and who isn't) and gives smart, per-exercise progression suggestions.

**Priority**: fast to build, trivial to deploy, near-zero ongoing maintenance. No self-hosted database, no Docker, no server to babysit. No native app — mobile-first responsive web only.

---

## Tech Stack
- **Frontend + API**: Next.js (App Router, TypeScript)
- **Database + Auth + Storage**: Supabase (hosted Postgres, storage for exercise videos if not using YouTube, free tier covers 40 users easily)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel — connect the GitHub repo, every push to `main` auto-deploys, zero server management
- **IDE**: VS Code with the Claude Code extension

This stack was chosen specifically to avoid the overhead of a self-hosted stack (no migrations project to run manually, no Docker image to build/push, no Postgres instance to maintain, no SSL/HTTPS to configure) while still keeping the code clean and organized.

---

## Structural Principles (borrowed from a Clean Architecture reference project, right-sized for this app)

The reference project this borrows from (`Al_Mohasib`) uses a strict "one service = one operation" pattern in a full .NET/Angular Clean Architecture setup. We keep the *spirit* of that — clear separation, one obvious place for each action, typed contracts — without the .NET-specific ceremony (no DI composition root, no separate migrations project, no architecture-rule test suite). Concretely:

- **One function per action**, not generic CRUD handlers. Each distinct action (`createPlayer`, `listPrograms`, `logSet`, `getAdherenceDashboard`) lives in its own clearly named file — mirrors the `ICreateXService` / `DbCreateXService` idea, just as a plain typed function instead of an interface+implementation pair.
- **Typed contracts** for every request/response shape, kept in a shared `types/` folder — same intent as Al_Mohasib's `Contracts/` folder.
- **Feature-based folders**, not type-based — same idea as Al_Mohasib's Angular `features/admin/players/`, `features/player/today/`.
- **Domain logic separated from data access** — business rules (progression logic, adherence calculation, active-program resolution) live in plain functions that take data in and return data out, independent of how that data was fetched. This keeps them testable without a database.

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
      /players            → createPlayer, updatePlayer, deletePlayer, listPlayers
      /exercises           → createExercise, updateExercise, deleteExercise, listExercises
      /programs             → createProgram, updateProgram, listPrograms
      /dashboard             → getAdherenceDashboard
    /player
      /session              → getTodaySession, getActiveProgram
      /log                  → logSet, getLastLogForExercise
      /history               → getPlayerHistory

/lib
  /actions                 → one file per action, e.g. createPlayer.ts, logSet.ts, getAdherenceDashboard.ts
  /domain                  → pure business logic, no DB calls
    progression.ts         → suggestNextWeight(progressionType, lastLog) → per-type rules
    adherence.ts            → calculateAdherence(scheduledSessions, loggedSessions)
    activeProgram.ts         → resolveActiveProgram(programs, date)
  /supabase
    client.ts               → Supabase client setup
    queries.ts               → raw Supabase query helpers, called by /lib/actions

/types
  player.ts
  exercise.ts
  program.ts
  session.ts

/components
  /admin                  → PlayerForm, ExerciseForm, ProgramBuilder, AdherenceTable
  /player                 → SessionCard, ExerciseStep, RestTimer, ProgressChart
  /shared                 → Button, Input, Select, ConfirmDialog, EmptyState, LoadingState

/supabase
  migrations/               → SQL migration files (Supabase CLI manages these)
```

---

## Data Model (Postgres / Supabase)

### `teams`
- `id`, `name` (e.g. "Palestine", "Cyprus"), `login_code` (unique)

### `players`
- `id`, `team_id` (FK), `name`, `position_group` (enum: `forward` | `back`, nullable), `is_admin` (bool), `is_player` (bool), `created_at`

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
- Enforce isolation with **Supabase Row Level Security (RLS)** policies on every tenant-owned table — reads and writes are scoped to the current session's `team_id`, resolved server-side at login, never trusted from the client.
- `exercises` has no `team_id` — it's shared globally on purpose.
- Players cannot transfer between teams (no update path exposed for `team_id` on `players` from the player side; admin-only, and only via explicit reassignment).

---

## Roles & Auth

**Login flow**: enter team code → select player name from that team's roster (or "I'm Admin"). No email/password, no magic links — this needs to work reliably for ~40 players.

- Roles are **two independent booleans** on `players`, not mutually exclusive:
  - `is_admin`
  - `is_player`
- A player-admin (e.g. team captain) gets `is_admin: true, is_player: true` — lands on the admin dashboard by default, with a toggle to switch into "My Training" (identical to the normal player experience).
- Pure admin/coach who doesn't train: `is_admin: true, is_player: false`.
- Normal player: `is_admin: false, is_player: true`.
- Session state (team_id, player_id, is_admin, is_player) is established server-side on login and stored in a secure cookie/session — never trust role flags sent from the client on subsequent requests.

---

## Position-Based Programming (Design Rationale)

Forwards and Backs get **fully separate exercise programs**, not shared exercises with different loading:

- **Forwards** (props, hookers, locks, back row): maximal strength and power in tight spaces (scrummaging, mauling, collisions).
  - Heavy compound lifts (squat, deadlift, bench, heavy rows) — low rep ranges (3–6)
  - Loaded carries / sled work
  - Neck and trap work for contact durability

- **Backs** (halves, centres, back three): speed, acceleration, change of direction, repeated sprint ability.
  - Olympic lift variants / plyometrics
  - Sprint mechanics and acceleration drills
  - Lighter, faster compound lifts, moderate load
  - Higher rep accessory work (8–12)

Both groups can share exercises where relevant (mobility, core, injury-prevention) simply by an admin including the same exercise in both programs — no special shared-program mechanism needed.

---

## Monthly Block / Periodization Logic

- Blocks (`programs`) run **4 weeks** — a standard mesocycle length, naturally supporting a deload week (typically week 4) without disrupting the calendar system.
- `resolveActiveProgram(programs, date)` in `/lib/domain/activeProgram.ts` determines which program is "live" for a given `team_id` + `position_group`, based purely on `start_date`/`end_date` — a pure function, easy to unit test.
- Admin creates next month's block ahead of time; switchover is automatic based on date. `is_active_override` allows a manual admin override if needed.
- If a player is mid-week when a block transitions, the currently scheduled days for that week still complete before the new block's days take over — this falls out naturally from resolving "today's program day" off the date, not a live mid-session switch.

---

## Progression Logic ("Smart" Weight/Rep Suggestions)

`suggestNextWeight(progressionType, lastLog)` in `/lib/domain/progression.ts` branches by `progression_type`:

| `progression_type` | Example exercises | Progression rule |
|---|---|---|
| `heavy_compound` | Squat, deadlift, bench, barbell rows | All sets hit target reps last session → suggest +2.5kg. Reps missed → hold weight. |
| `light_compound_isolation` | Lateral raises, curls, tricep work | All sets hit top of rep range (e.g. 12) → suggest +1kg, reset to bottom of range (e.g. 8). Not yet at top → suggest +1 rep instead of adding weight. |
| `bodyweight_plyo` | Box jumps, sprints, core work | No weight progression — progress via reps/sets/tempo (coach-defined per block). |
| `carry_loaded` | Farmer's carries, sled push/pull | Progress via distance or time based on whether target was hit last session. |

**v1**: `getLastLogForExercise` pre-fills the weight/reps input with the player's last logged value for that `program_exercise_id`. **v2**: layer in the full `suggestNextWeight` rules above.

---

## Player-Facing Features

1. **Login**: team code → select name from roster.
2. **Today's Session** (`/player/today`): shows the scheduled session for today, resolved from the active program + program day mapped to today's day-of-week. No session scheduled → rest-day state.
3. **Exercise logging flow** (`/player/log/[sessionId]`): step through exercises in order — name, embedded video, target sets/reps, weight+reps input pre-filled from last session, **rest timer** component auto-starts after each set, sound/vibration alert at zero.
4. **Session history** (`/player/history`): own past logs + simple line chart of weight-over-time per exercise.
5. **Visibility**: players see only their own data by default. Optional **team-only leaderboard** (opt-in/toggleable), never cross-team.
6. No injury/exemption tracking in v1.

---

## Admin-Facing Features

1. **Players** (`/admin/players`): add/remove/edit; assign team, position group, toggle `is_admin`/`is_player`.
2. **Exercises** (`/admin/exercises`): add/edit/remove; name, video URL, `progression_type`.
3. **Programs** (`/admin/programs`): build monthly block — team + position group, start date (end date auto = +4 weeks, editable), then 4 `program_days`, each with an ordered list of `program_exercises` (sets, reps, rest, notes).
4. **Adherence dashboard** (`/admin/dashboard`): table, filterable by team — sessions logged this week vs scheduled, last log date, sortable to surface who's falling behind. **Highest priority admin screen — build early.**
5. Admin with `is_player: true` gets a toggle into their own "My Training" view.

---

## Offline Support (In Scope)
Gym wifi/signal is often unreliable. Player-side logging must work offline and sync once connectivity returns — local-first writes (e.g. IndexedDB or optimistic local state) with background sync of `sessions`/`logs` to Supabase once connection resumes.

---

## Build Priority Order

1. Supabase project setup + schema (all tables above) + RLS policies
2. Login flow (team code + name/role selection, server-side session)
3. Admin: Players CRUD
4. Admin: Exercises CRUD
5. Admin: Program builder (programs → program_days → program_exercises)
6. Player: Today's Session view + exercise logging flow + rest timer
7. Admin: Adherence dashboard
8. Player: session history / progress chart
9. Progression pre-fill logic (last-session values)
10. Progression auto-suggestion rules (`suggestNextWeight`)
11. Offline sync for player logging
12. Leaderboard (optional, team-scoped, toggleable)
13. Deploy: connect repo to Vercel, connect Supabase project, done

---

## Explicitly Out of Scope (v1)
- Native mobile app (web only, mobile-responsive)
- Injury/exemption tracking UI
- Cross-team visibility of any kind
- Email/password auth or magic links
