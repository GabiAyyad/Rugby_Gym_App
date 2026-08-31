# Architecture notes

Read this before adding a feature. It records the decisions that are already
made, so each feature slots into the same shape.

## Layers

```
app/**/page.tsx        server component; guards, then renders
app/api/**/route.ts    thin HTTP wrapper: parse -> one action -> ApiResult
lib/actions/*.ts       one file per action, one exported function, server-only
lib/domain/*.ts        pure business rules, no DB, unit tested
lib/supabase/queries/  raw Supabase calls, one module per feature area
components/**          UI; shared primitives in components/shared
types/*.ts             request/response contracts shared by client and server
```

Rules:

- **One action per file**, named for the action (`createPlayer.ts` exports
  `createPlayer`). No generic CRUD handlers.
- Actions take the caller's `SessionUser` as the **first argument** and scope
  every query to `session.teamId`. This is the only thing keeping the two squads
  apart, so it is a type-level requirement rather than a convention.
- Domain functions take data in and return data out. If a function in
  `lib/domain` needs a database, it is in the wrong folder.
- Route handlers do not contain business logic. `parseBody` -> action -> return.

## Auth

Login is team code -> pick a name -> admin PIN (admins only). No Supabase Auth,
no email, no magic links.

- Session lives in a signed httpOnly cookie (`lib/session.ts`, HS256 via jose).
- `lib/auth.ts` exposes `requireAdmin()` / `requirePlayer()` (throw, for routes)
  and `requireAdminPage()` / `requirePlayerPage()` (redirect, for pages).
- `is_admin` and `is_player` are independent booleans. A player-captain has both
  and gets a switch in the nav.
- **Never** read `teamId`, `playerId` or role flags from a request body.

## Multi-tenancy

Every `players` and `programs` row carries `team_id`. `exercises` is global on
purpose — the library is shared, the programs built from it are not.

RLS is enabled on every table with **zero permissive policies**, so the anon key
can read nothing. All access goes through the service role key server-side, and
team scoping is enforced in `lib/actions`. See the comment at the top of
`supabase/migrations/20260831000002_rls.sql`.

## The week model

Program days are **not** pinned to weekdays. A block has up to 4 days; the player
trains the next unfinished day whenever they get to the gym, and can open any day
directly. Weeks run Monday to Sunday (`lib/domain/week.ts`).

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
  boundary. Use `lib/domain/week.ts` for all date maths.
- Money-free numbers: weights are `numeric(6,2)` in kg.
- API responses are always `ApiResult<T>` (`types/common.ts`). Clients use
  `lib/api.ts`, which throws `ApiError` on the failure branch.
- Errors: throw `ActionError(message, status, fieldErrors?)` from an action for
  anything the user should see. `lib/http.ts` maps everything else.
- UI: mobile first. Nothing below a 44px tap target. Shared primitives come from
  `@/components/shared` — do not hand-roll another button.
- `types/database.ts` mirrors the migrations by hand. Change both together, and
  keep the row types as `type` aliases, not `interface` — supabase-js needs the
  implicit index signature.
