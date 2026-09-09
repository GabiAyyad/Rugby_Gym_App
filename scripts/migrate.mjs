// Applies every file in db/migrations, in filename order, inside a transaction
// each. Tracks what has already run in a schema_migrations table so this is
// safe to re-run — a fresh database and one that's already partway there both
// end up fully migrated.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

/**
 * Connects, ensures the tracking table exists, then applies every .sql file
 * under db/migrations that isn't already recorded in `schema_migrations`, in
 * filename order. Each file runs inside its own transaction, so a failure
 * partway through one migration rolls that one back cleanly without touching
 * migrations that already succeeded.
 */
async function main() {
  await client.connect();
  // Tracks which migration files have already been applied, so re-running
  // this script is always safe — only new files get executed.
  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = new Set(
    (await client.query('select name from schema_migrations')).rows.map((row) => row.name),
  );

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  let ran = 0;

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    console.log(`Applying ${file}...`);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      ran += 1;
    } catch (error) {
      await client.query('rollback');
      console.error(`Failed on ${file}:`, error.message);
      process.exit(1);
    }
  }

  console.log(ran === 0 ? 'Already up to date.' : `Applied ${ran} migration(s).`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
