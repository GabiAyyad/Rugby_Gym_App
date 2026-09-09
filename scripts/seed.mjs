// Loads db/seed.sql. Idempotent (the seed itself uses ON CONFLICT DO NOTHING).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

/** Connects, runs db/seed.sql wholesale, then prints a summary of what's now in the database. */
async function main() {
  await client.connect();
  const sql = await readFile(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');
  await client.query(sql);
  const teams = await client.query('select name, login_code from teams order by name');
  const exercises = await client.query('select count(*)::int as count from exercises');
  console.log('Seeded teams:');
  for (const row of teams.rows) console.log(`  ${row.name} — ${row.login_code}`);
  console.log(`Exercise library: ${exercises.rows[0].count} exercises.`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
