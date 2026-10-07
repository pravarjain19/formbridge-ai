/**
 * Public Supabase settings. Newer projects issue a "publishable" key
 * (sb_publishable_...); older ones an "anon" JWT. Either works for the
 * browser/server clients, and RLS applies to both.
 * Each env var is referenced literally so Next.js can inline it in the browser bundle.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);
