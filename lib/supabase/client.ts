import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let singleton: SupabaseClient | null | undefined;
export function getSupabase() {
  if (singleton !== undefined) return singleton;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  singleton =
    url && key
      ? createClient(url, key, {
          auth: {
            flowType: 'pkce',
            persistSession: true,
            detectSessionInUrl: true,
          },
        })
      : null;
  return singleton;
}

export const isSupabaseConfigured = () =>
  Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
