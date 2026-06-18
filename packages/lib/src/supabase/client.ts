import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@ipsi/db';
import { getSupabaseAnonKey, getSupabaseAuthCookieName, getSupabaseUrl } from '../env';

export function createBrowserSupabaseClient() {
  const cookieName = getSupabaseAuthCookieName();
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: cookieName ? { name: cookieName } : undefined,
  });
}
