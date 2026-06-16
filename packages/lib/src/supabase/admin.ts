import { createClient } from '@supabase/supabase-js';
import type { Database } from '@ipsi/db';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '../env';

/**
 * Service-role client — bypasses RLS.
 * NEVER expose to the browser. Server-only (route handlers / server actions).
 */
export function createAdminSupabaseClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
