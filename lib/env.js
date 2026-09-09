import 'server-only';

/** Reads an env var, throwing a helpful error (pointing at SETUP.md) if it's missing. */
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in — see SETUP.md.`,
    );
  }
  return value;
}

/**
 * The app's two required secrets, exposed as lazy getters (so a missing
 * variable only throws when actually used, not at import time — important
 * since this module is imported by files that run during the build too).
 */
export const env = {
  /** The Postgres connection string. See lib/db/pool.js for how it's used. */
  get databaseUrl() {
    return required('DATABASE_URL');
  },
  /** Signs/verifies the session cookie (lib/session.js). Must be at least 32 characters. */
  get sessionSecret() {
    const secret = required('SESSION_SECRET');
    if (secret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters.');
    }
    return secret;
  },
};
