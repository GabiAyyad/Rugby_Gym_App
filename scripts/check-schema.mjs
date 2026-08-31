/*
 * Validates supabase/migrations + supabase/seed.sql against a real Postgres,
 * in process, with no Docker and no network. Run it after touching any SQL:
 *
 *   npm run test:schema
 *
 * It checks that the migrations apply, that RLS ends up locked down, that the
 * CHECK constraints reject the states they are meant to, and — the load-bearing
 * one — that replaying a queued session or set upserts instead of duplicating,
 * which is what makes offline logging safe.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');

let failures = 0;
const pass = (name, extra = '') => console.log(`  PASS  ${name}${extra}`);
const fail = (name, detail) => {
  failures += 1;
  console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
};

const db = await PGlite.create({ extensions: { pgcrypto } });

// Supabase ships these roles; a bare Postgres does not.
await db.exec(`do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;`);

console.log('migrations');
for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
    pass(file);
  } catch (error) {
    fail(file, error.message);
    process.exit(1);
  }
}

const seedSql = readFileSync(join(ROOT, 'supabase', 'seed.sql'), 'utf8');
try {
  await db.exec(seedSql);
  await db.exec(seedSql); // must be safe to re-run
  const { rows } = await db.query('select count(*)::int as n from exercises');
  const teams = await db.query('select name, login_code from teams order by name');
  pass('seed.sql', ` (${teams.rows.length} teams, ${rows[0].n} exercises, re-runnable)`);
} catch (error) {
  fail('seed.sql', error.message);
  process.exit(1);
}

console.log('\nrow level security');
const tables = await db.query(`
  select relname, relrowsecurity, relforcerowsecurity from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' order by relname`);
const unlocked = tables.rows.filter((t) => !t.relrowsecurity || !t.relforcerowsecurity);
if (unlocked.length) fail('every table has RLS enabled and forced', unlocked.map((t) => t.relname).join(', '));
else pass('every table has RLS enabled and forced', ` (${tables.rows.length} tables)`);

const policies = await db.query(`select count(*)::int as n from pg_policies where schemaname = 'public'`);
if (policies.rows[0].n !== 0) fail('no permissive policies exist', `found ${policies.rows[0].n}`);
else pass('no permissive policies exist, so the anon key can read nothing');

async function expectOk(name, sql, params = []) {
  try {
    await db.query(sql, params);
    pass(name);
  } catch (error) {
    fail(name, error.message);
  }
}

async function expectReject(name, sql, params, expectedCodes) {
  try {
    await db.query(sql, params);
    fail(name, 'was accepted, should have been rejected');
  } catch (error) {
    const code = error.code ?? '?';
    if (expectedCodes.includes(code)) pass(name, ` (rejected ${code})`);
    else fail(name, `rejected with ${code}, expected one of ${expectedCodes.join('/')}`);
  }
}

const team = (await db.query(`select id from teams where name = 'Palestine'`)).rows[0].id;

console.log('\nplayer roles and positions');
await expectOk('a normal player with a position group',
  `insert into players (team_id, name, position_group, is_player) values ($1,'Sami','forward',true)`, [team]);
await expectReject('a record with neither role',
  `insert into players (team_id, name, is_admin, is_player) values ($1,'NoRole',false,false)`, [team], ['23514']);
await expectReject('an admin with no PIN',
  `insert into players (team_id, name, is_admin, is_player) values ($1,'PinLess',true,false)`, [team], ['23514']);
await expectReject('a player with no position group',
  `insert into players (team_id, name, is_player) values ($1,'Positionless',true)`, [team], ['23514']);
await expectReject('a duplicate name inside one team',
  `insert into players (team_id, name, position_group, is_player) values ($1,'Sami','back',true)`, [team], ['23505']);
await expectOk('the same name on the other team',
  `insert into players (team_id, name, position_group, is_player)
   select id,'Sami','back',true from teams where name = 'Cyprus'`);
await expectOk('a player-captain holding both roles',
  `insert into players (team_id, name, position_group, is_admin, is_player, admin_pin_hash)
   values ($1,'Captain','forward',true,true,'scrypt$16384$salt$digest')`, [team]);

console.log('\nblocks, days and exercises');
const player = (await db.query(`select id from players where name='Sami' and team_id=$1`, [team])).rows[0].id;
const program = (await db.query(
  `insert into programs (team_id, position_group, name, start_date, end_date)
   values ($1,'forward','September Block','2026-09-01','2026-09-28') returning id`, [team])).rows[0].id;
await expectReject('a block that ends before it starts',
  `insert into programs (team_id, position_group, name, start_date, end_date)
   values ($1,'forward','Backwards','2026-09-28','2026-09-01')`, [team], ['23514']);

const day = (await db.query(
  `insert into program_days (program_id, day_number, label) values ($1,1,'Lower Power') returning id`,
  [program])).rows[0].id;
await expectReject('a fifth training day in a block',
  `insert into program_days (program_id, day_number) values ($1,5)`, [program], ['23514']);
await expectReject('two day ones in one block',
  `insert into program_days (program_id, day_number) values ($1,1)`, [program], ['23505']);

const squat = (await db.query(`select id from exercises where name='Back Squat'`)).rows[0].id;
const plank = (await db.query(`select id from exercises where name='Plank'`)).rows[0].id;
const programExercise = (await db.query(
  `insert into program_exercises (program_day_id, exercise_id, "order", target_sets, target_reps, rest_seconds)
   values ($1,$2,1,3,'3-6',180) returning id`, [day, squat])).rows[0].id;

// RESTRICT raises 23001, not 23503 - lib/supabase/queries/index.ts accepts both.
await expectReject('deleting an exercise a block still uses',
  `delete from exercises where id=$1`, [squat], ['23503', '23001']);
await expectOk('two exercises sharing an order value while reordering',
  `insert into program_exercises (program_day_id, exercise_id, "order", target_sets, target_reps)
   values ($1,$2,1,3,'8-10')`, [day, plank]);

console.log('\noffline replay');
const upsertSession = `insert into sessions (id, player_id, program_day_id, date)
  values (gen_random_uuid(), $1, $2, '2026-09-01')
  on conflict (player_id, program_day_id, date) do update set completed_at = excluded.completed_at`;
await expectOk('first sync of a queued session', upsertSession, [player, day]);
await expectOk('replaying that same session', upsertSession, [player, day]);
const sessionCount = (await db.query('select count(*)::int as n from sessions')).rows[0].n;
if (sessionCount === 1) pass('replay left exactly one session row');
else fail('replay left exactly one session row', `got ${sessionCount}`);

const session = (await db.query('select id from sessions limit 1')).rows[0].id;
const upsertLog = `insert into logs (id, session_id, program_exercise_id, set_number, reps_done, weight_used)
  values (gen_random_uuid(), $1, $2, 1, 6, 100)
  on conflict (session_id, program_exercise_id, set_number)
  do update set reps_done = excluded.reps_done, weight_used = excluded.weight_used`;
await db.query(upsertLog, [session, programExercise]);
await db.query(upsertLog, [session, programExercise]);
const logCount = (await db.query('select count(*)::int as n from logs')).rows[0].n;
if (logCount === 1) pass('replaying a set updated it instead of duplicating');
else fail('replaying a set updated it instead of duplicating', `got ${logCount} rows`);

await expectReject('a set numbered zero',
  `insert into logs (session_id, program_exercise_id, set_number) values ($1,$2,0)`,
  [session, programExercise], ['23514']);

console.log('\ncascades');
await db.query('delete from players where id=$1', [player]);
const leftovers =
  (await db.query('select count(*)::int as n from sessions')).rows[0].n +
  (await db.query('select count(*)::int as n from logs')).rows[0].n;
if (leftovers === 0) pass('deleting a player removed their sessions and logs');
else fail('deleting a player removed their sessions and logs', `${leftovers} rows left behind`);

console.log(failures === 0 ? '\nSchema OK.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
