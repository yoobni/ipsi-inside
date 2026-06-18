import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@ipsi/db';
import { getSupabaseAnonKey, getSupabaseAuthCookieName, getSupabaseUrl } from '../env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  const cookieName = getSupabaseAuthCookieName();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: cookieName ? { name: cookieName } : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — cookies are read-only there.
          // The proxy will refresh the session for us.
        }
      },
    },
  });
}
