# Architecture notes

Read this before adding a feature. It records the decisions that are already
made, so each feature slots into the same shape. This is the JS/PostgreSQL
port of the original TypeScript/Supabase app — the shape below is identical to
that app's `docs/ARCHITECTURE.md`; only the plumbing underneath changed.

## Layers

```
app/**/page.js          server component; guards, then renders
app/api/**/route.js     thin HTTP wrapper: parse -> one action -> ApiResult
lib/actions/*.js        one file per action, one exported function, server-only
lib/domain/*.js         pure business rules, no DB, unit tested
lib/db/queries/         raw SQL (pg), one module per feature area
lib/db/pool.js          the one connection pool + Postgres type parsers
components/**           UI; shared primitives in components/shared
types/*.js              JSDoc typedefs — documentation only, no compile-time check
```

Rules:

- **One action per file**, named for the action (`createPlayer.js` exports
  `createPlayer`). No generic CRUD handlers.
- Actions take the caller's `SessionUser` as the **first argument** and scope
  every query to `session.teamId`. This is the only thing keeping the two squads
  apart, so treat it as a hard rule, not a convention — there is no compiler to
  catch a forgotten scope in plain JS.
- Domain functions take data in and return data out. If a function in
  `lib/domain` needs a database, it is in the wrong folder.
- Route handlers do not contain business logic. `parseBody` (or manual
  validation from `lib/validate.js`) -> action -> return.

## Auth

Login is team code -> pick a name -> admin PIN (admins only). No third-party
auth provider, no email, no magic links.

- Session lives in a signed httpOnly cookie (`lib/session.js`, HS256 via jose).
- `lib/auth.js` exposes `requireAdmin()` / `requirePlayer()` (throw, for routes)
  and `requireAdminPage()` / `requirePlayerPage()` (redirect, for pages).
- `is_admin` and `is_player` are independent booleans. A player-captain has both
  and gets a switch in the nav.
- **Never** read `teamId`, `playerId` or role flags from a request body.

## Database access

There is no ORM. `lib/db/pool.js` holds one `pg.Pool`; `lib/db/queries/*.js`
are hand-written parameterised SQL, one module per feature area, mirroring the
original Supabase query modules function-for-function. `lib/db/helpers.js`
provides `one`/`many`/`run` (wrap a query, throw `DataError` on failure) and
`valuesList` (build a multi-row `INSERT ... VALUES (...), (...)`  for bulk
upserts like `upsertSessions`/`upsertLogs`).

Two Postgres type-parser overrides in `pool.js` matter and are easy to
reintroduce a bug by removing:

- `date` (oid 1082) is returned as the raw string, not parsed into a JS
  `Date` — otherwise a date can silently shift a day under a timezone that
  isn't UTC. Every date in this app is a `'YYYY-MM-DD'` string end to end.
- `numeric` (oid 1700) is parsed to a JS number, so `weight_used` arrives as
  `102.5`, not `"102.50"`.

## Multi-tenancy

Every `players` and `programs` row carries `team_id`. `exercises` is global on
purpose — the library is shared, the programs built from it are not.

Unlike the Supabase original, there is **no RLS layer** here: this
architecture never gives a browser-facing key that can reach Postgres at all —
the connection string is a private secret held only by the Next.js server
process (see `lib/env.js`), so the "second lock" RLS provided in the original
has no analogous leak to defend against. Team scoping is enforced exactly once,
in `lib/actions`, and that is the only thing separating the two squads. Keep it
that way — do not add a code path that queries `players` or `programs` without
a `team_id` in the `WHERE` clause.

## The week model

Program days are **not** pinned to weekdays. A block has up to 4 days; the player
trains the next unfinished day whenever they get to the gym, and can open any day
directly. Weeks run Monday to Sunday (`lib/domain/week.js`).

Adherence is derived, never stored: a player trained on a day exactly when
`logs` rows exist for a session of theirs. Repeats of the same program day inside
one week count once.

## Offline

Player logging is local-first. Sets are queued in IndexedDB with a client id and
replayed through `POST /api/player/sync`. Replay is idempotent because sessions
upsert on `(player_id, program_day_id, date)` and logs on
`(session_id, program_exercise_id, set_number)` — the same entry sent twice
updates rather than duplicates.

## Conventions

- Dates are `'YYYY-MM-DD'` strings end to end. Never pass a `Date` across a
  boundary. Use `lib/domain/week.js` for all date maths.
- Money-free numbers: weights are `numeric(6,2)` in kg.
- API responses are always `ApiResult` (`types/common.js`, JSDoc only). Clients
  use `lib/api.js`, which throws `ApiError` on the failure branch.
- Errors: throw `ActionError(message, status, fieldErrors?)` from an action for
  anything the user should see. `lib/http.js` maps everything else.
- UI: mobile first. Nothing below a 44px tap target. Shared primitives come from
  `@/components/shared` — do not hand-roll another button. Styling is plain CSS
  (`app/globals.css` for tokens/utilities, `styles/components.css` for shared
  component classes) — no Tailwind, no CSS-in-JS.
- `types/database.js` mirrors the migrations by hand, as JSDoc typedefs plus
  the two enum value arrays (`POSITION_GROUPS`, `PROGRESSION_TYPE_VALUES`).
  Change both together.
