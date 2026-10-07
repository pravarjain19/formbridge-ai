import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, supabaseConfigured } from "./env";

export { supabaseConfigured };

/**
 * Request-scoped Supabase client that acts as the signed-in user, so every
 * query and Storage call is subject to RLS. Never use the service-role key in
 * user-facing routes.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component where cookies are read-only; middleware refreshes the session.
          }
        },
      },
    },
  );
}

/** For pages and server actions under /app: returns the user or redirects to /login. */
export async function requireUser() {
  if (!supabaseConfigured()) redirect("/setup");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
}
