-- Row Level Security: lock every table down to nothing.
--
-- This app does not use Supabase Auth (login is team code + roster name + admin
-- PIN, per spec), so there is no `auth.uid()` / JWT claim for a policy to read.
-- Tenant isolation is therefore enforced one layer up, in `lib/auth.ts`, which
-- resolves team_id from the signed server-side session cookie and scopes every
-- query to it. The client never sends a team_id, player_id or role flag that is
-- trusted.
--
-- RLS here is the second lock, not the first: enabling it with zero permissive
-- policies means the anon and authenticated keys can read and write nothing at
-- all, so a leaked NEXT_PUBLIC key is inert. Only the service role key — which
-- bypasses RLS and lives server-side only, never in a NEXT_PUBLIC_ variable —
-- can touch data.

alter table teams             enable row level security;
alter table players           enable row level security;
alter table exercises         enable row level security;
alter table programs          enable row level security;
alter table program_days      enable row level security;
alter table program_exercises enable row level security;
alter table sessions          enable row level security;
alter table logs              enable row level security;

-- Force RLS even for the tables' owner, so nothing but the service role slips through.
alter table teams             force row level security;
alter table players           force row level security;
alter table exercises         force row level security;
alter table programs          force row level security;
alter table program_days      force row level security;
alter table program_exercises force row level security;
alter table sessions          force row level security;
alter table logs              force row level security;

-- Defence in depth: revoke the default PostgREST grants as well, so the anon and
-- authenticated roles cannot even see the tables exist.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
