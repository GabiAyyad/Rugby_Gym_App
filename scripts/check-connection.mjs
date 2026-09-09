// Preflight: confirms DATABASE_URL and SESSION_SECRET are set, the database is
// reachable, the schema has been migrated, and the seed has loaded. Run this
// whenever "the app can't see the database" — it tells you which step to redo.
import pg from 'pg';

const EXPECTED_TABLES = [
  'teams',
  'players',
  'exercises',
  'programs',
  'program_days',
  'program_exercises',
  'sessions',
  'logs',
];

/** Prints a red ✗ line and marks the script as failed, without stopping the remaining checks. */
function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

/**
 * Runs every preflight check in order — env vars, connectivity, schema,
 * seed data — printing a ✓/✗ line for each. Later checks still run even if
 * an earlier one fails, so a single run reports everything that's wrong at
 * once rather than stopping at the first problem.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!connectionString) {
    fail('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
    return;
  }
  console.log('✓ DATABASE_URL is set.');

  if (!sessionSecret || sessionSecret.length < 32) {
    fail('SESSION_SECRET is missing or shorter than 32 characters.');
  } else {
    console.log('✓ SESSION_SECRET is set.');
  }

  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('✓ Database is reachable.');
  } catch (error) {
    fail(`Could not connect to the database: ${error.message}`);
    return;
  }

  try {
    const result = await client.query(
      `select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const present = new Set(result.rows.map((row) => row.table_name));
    const missing = EXPECTED_TABLES.filter((name) => !present.has(name));
    if (missing.length > 0) {
      fail(`Missing tables: ${missing.join(', ')}. Run "npm run db:migrate".`);
    } else {
      console.log('✓ All eight tables exist.');
    }

    if (missing.length === 0) {
      const teams = await client.query('select count(*)::int as count from teams');
      const exercises = await client.query('select count(*)::int as count from exercises');
      if (teams.rows[0].count === 0) {
        fail('No teams found. Run "npm run db:seed".');
      } else {
        console.log(`✓ Seed loaded: ${teams.rows[0].count} team(s), ${exercises.rows[0].count} exercise(s).`);
      }
    }
  } catch (error) {
    fail(`Could not inspect the schema: ${error.message}`);
  } finally {
    await client.end();
  }

  if (process.exitCode) {
    console.log('\nSee SETUP.md for the full setup sequence.');
  } else {
    console.log('\nEverything checks out. Run "npm run dev".');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
