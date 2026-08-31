import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { env } from '@/lib/env';

export type Db = SupabaseClient<Database>;

let cached: Db | null = null;

/**
 * The one database handle in the app. It carries the service role key, so it
 * bypasses RLS entirely — every caller is responsible for scoping its query to
 * the session's team_id. Use the helpers in lib/auth.ts rather than reading
 * team_id off a request body.
 */
export function db(): Db {
  if (!cached) {
    cached = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-application-name': 'rugby-gym-app' } },
    });
  }
  return cached;
}
