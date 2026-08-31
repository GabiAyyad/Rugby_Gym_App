/*
 * Preflight for a real Supabase project. Run it after filling in .env.local,
 * and any time the app starts behaving as though the database is not there:
 *
 *   npm run check:db
 *
 * It answers the three questions that actually go wrong during setup: are the
 * variables present, does the key reach the project, and has the schema been
 * pushed and seeded.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env.local reader so this runs without pulling in a dotenv dependency.
for (const file of ['.env.local', '.env']) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, '');
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

const problems = [];
const note = (ok, message, detail) =>
  console.log(`  ${ok ? 'OK  ' : 'MISS'} ${message}${detail ? `\n       ${detail}` : ''}`);

console.log('environment');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const secret = process.env.SESSION_SECRET;

if (!url) problems.push('NEXT_PUBLIC_SUPABASE_URL is not set.');
note(Boolean(url), 'NEXT_PUBLIC_SUPABASE_URL', url);

if (!key) problems.push('SUPABASE_SERVICE_ROLE_KEY is not set.');
else if (key.length < 40) problems.push('SUPABASE_SERVICE_ROLE_KEY looks too short to be a real key.');
note(Boolean(key), 'SUPABASE_SERVICE_ROLE_KEY', key ? `${key.slice(0, 6)}… (${key.length} chars)` : undefined);

if (!secret) problems.push('SESSION_SECRET is not set.');
else if (secret.length < 32) problems.push('SESSION_SECRET must be at least 32 characters.');
note(Boolean(secret) && secret.length >= 32, 'SESSION_SECRET', secret ? `${secret.length} chars` : undefined);

if (url && /\/rest\/v1\/?$/.test(url.trim())) {
  problems.push(
    'NEXT_PUBLIC_SUPABASE_URL is the REST endpoint, not the project URL. Drop the trailing' +
      ` "/rest/v1" so it reads ${url.trim().replace(/\/rest\/v1\/?$/, '')} — supabase-js adds that path itself.`,
  );
}

if (problems.length) {
  console.log('\nFix these first (see SETUP.md):');
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(1);
}

console.log('\nconnection');
const db = createClient(url, key, { auth: { persistSession: false } });

const TABLES = ['teams', 'players', 'exercises', 'programs', 'program_days', 'program_exercises', 'sessions', 'logs'];
const unreachable = (message) => /fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo|network/i.test(message);

let missing = 0;
let offline = false;
for (const table of TABLES) {
  // A head request does not surface a bad path as an error, so select real
  // rows: a wrong URL then fails loudly instead of reporting an empty table.
  const { error, count } = await db.from(table).select('id', { count: 'exact' }).limit(1);
  if (error) {
    missing += 1;
    if (unreachable(error.message)) offline = true;
    note(false, table, error.message);
  } else {
    note(true, `${table} (${count === null ? 'count unavailable' : `${count} rows`})`);
  }
}

if (offline) {
  console.log(
    `
Could not reach ${url}. Check the project URL, that the project is not paused in the` +
      ' Supabase dashboard, and that this machine has a network connection.',
  );
  process.exit(1);
}
if (missing === TABLES.length) {
  console.log('\nNo tables found. Push the schema:\n  npx supabase link --project-ref <ref>\n  npx supabase db push');
  process.exit(1);
}
if (missing > 0) {
  console.log(`\n${missing} table(s) missing — re-run "npx supabase db push".`);
  process.exit(1);
}

const { data: teams } = await db.from('teams').select('name, login_code').order('name');
const { data: admins } = await db.from('players').select('team_id').eq('is_admin', true);

console.log('\nsquads');
if (!teams?.length) {
  console.log('  MISS no teams yet — run supabase/seed.sql in the Supabase SQL editor.');
  process.exit(1);
}
for (const team of teams) {
  console.log(`  OK   ${team.name} — login code ${team.login_code}`);
}
console.log(
  (admins?.length ?? 0) === 0
    ? '\nNo admin accounts yet. Open the app, enter a team code, and choose "Set up the first admin account".'
    : `\nReady. ${admins.length} admin account(s) exist; sign in with a team code and PIN.`,
);
