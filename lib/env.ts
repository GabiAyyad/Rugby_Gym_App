import 'server-only';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in — see SETUP.md.`,
    );
  }
  return value;
}

/**
 * The Supabase dashboard shows both the project URL and the REST endpoint, and
 * the REST one is the easier of the two to copy by mistake. supabase-js appends
 * `/rest/v1` itself, so a pasted endpoint produces `/rest/v1/rest/v1/...` and
 * every query fails with a 404 that reads like "the database is unreachable".
 * Normalising here turns a confusing outage into a warning.
 */
function normaliseSupabaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  const stripped = trimmed.replace(/\/rest\/v1$/, '');
  if (stripped !== trimmed) {
    console.warn(
      `NEXT_PUBLIC_SUPABASE_URL looks like the REST endpoint. Using ${stripped} instead — ` +
        'copy the "Project URL" from Supabase → Project Settings → Data API.',
    );
  }
  return stripped;
}

export const env = {
  get supabaseUrl() {
    return normaliseSupabaseUrl(required('NEXT_PUBLIC_SUPABASE_URL'));
  },
  /**
   * Bypasses RLS. Server-only, never exposed to the browser — the RLS migration
   * leaves the anon key with no readable tables at all, so this is the only key
   * that can touch data.
   */
  get supabaseServiceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get sessionSecret() {
    const secret = required('SESSION_SECRET');
    if (secret.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters.');
    }
    return secret;
  },
};
