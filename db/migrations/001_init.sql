-- Rugby Team Training App — core schema
-- Two squads (Palestine, Cyprus), position-split monthly training blocks, per-set logging.
--
-- Plain PostgreSQL: no Supabase, no RLS. The Postgres role this connects as is a
-- private credential that only the Next.js server process ever holds (see
-- lib/db/pool.js and lib/env.js) — nothing public-facing can reach this database
-- directly, so tenant isolation is enforced one layer up in lib/actions, exactly
-- as it is documented in docs/ARCHITECTURE.md.

create extension if not exists "pgcrypto";

create type position_group as enum ('forward', 'back');

create type progression_type as enum (
  'heavy_compound',
  'light_compound_isolation',
  'bodyweight_plyo',
  'carry_loaded'
);

-- ---------------------------------------------------------------- teams
create table teams (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  login_code          text not null unique,
  leaderboard_enabled boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------- players
-- is_admin / is_player are independent: a player-captain has both.
-- Admins additionally need a PIN; the team login code alone must not unlock admin.
create table players (
  id                 uuid primary key default gen_random_uuid(),
  team_id            uuid not null references teams(id) on delete cascade,
  name               text not null,
  position_group     position_group,
  is_admin           boolean not null default false,
  is_player          boolean not null default true,
  admin_pin_hash     text,
  leaderboard_opt_in boolean not null default false,
  created_at         timestamptz not null default now(),
  constraint players_name_unique_per_team unique (team_id, name),
  constraint players_has_a_role check (is_admin or is_player),
  constraint players_admin_requires_pin check (not is_admin or admin_pin_hash is not null),
  constraint players_playing_requires_position check (not is_player or position_group is not null)
);
create index players_team_id_idx on players (team_id);

-- ---------------------------------------------------------------- exercises
-- Deliberately global (no team_id): the library is shared, the programs built
-- from it are team-specific.
create table exercises (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  video_url        text,
  movement_pattern text,
  progression_type progression_type not null,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------- programs
create table programs (
  id                 uuid primary key default gen_random_uuid(),
  team_id            uuid not null references teams(id) on delete cascade,
  position_group     position_group not null,
  name               text not null,
  start_date         date not null,
  end_date           date not null,
  is_active_override boolean,
  created_at         timestamptz not null default now(),
  constraint programs_dates_ordered check (end_date >= start_date)
);
create index programs_lookup_idx on programs (team_id, position_group, start_date, end_date);

-- One row per training day (1-4) within a block, e.g. "Day 1 - Lower Power".
create table program_days (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  day_number smallint not null,
  label      text,
  constraint program_days_number_range check (day_number between 1 and 4),
  constraint program_days_number_unique unique (program_id, day_number)
);
create index program_days_program_idx on program_days (program_id);

-- One row per exercise scheduled on a program_day, with its own sets/reps/rest/notes.
create table program_exercises (
  id              uuid primary key default gen_random_uuid(),
  program_day_id  uuid not null references program_days(id) on delete cascade,
  exercise_id     uuid not null references exercises(id) on delete restrict,
  "order"         smallint not null,
  target_sets     smallint not null,
  target_reps     text not null,
  rest_seconds    smallint not null default 90,
  notes           text,
  constraint program_exercises_sets_positive check (target_sets > 0),
  constraint program_exercises_rest_non_negative check (rest_seconds >= 0)
);
create index program_exercises_day_idx on program_exercises (program_day_id, "order");

-- ---------------------------------------------------------------- sessions & logs
-- A session is one player working one program day on one date. The natural key
-- makes offline replay idempotent: the same queued session upserts, never duplicates.
create table sessions (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references players(id) on delete cascade,
  program_day_id uuid not null references program_days(id) on delete cascade,
  date           date not null,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  constraint sessions_natural_key unique (player_id, program_day_id, date)
);
create index sessions_player_date_idx on sessions (player_id, date desc);

-- logs is the source of truth for attendance, adherence and progress: a player
-- "trained" on a day exactly when logs rows exist for that session.
create table logs (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references sessions(id) on delete cascade,
  program_exercise_id uuid not null references program_exercises(id) on delete cascade,
  set_number          smallint not null,
  reps_done           smallint,
  weight_used         numeric(6, 2),
  distance_or_time    text,
  logged_at           timestamptz not null default now(),
  constraint logs_set_number_positive check (set_number > 0),
  constraint logs_natural_key unique (session_id, program_exercise_id, set_number)
);
create index logs_session_idx on logs (session_id);
create index logs_exercise_history_idx on logs (program_exercise_id, logged_at desc);
