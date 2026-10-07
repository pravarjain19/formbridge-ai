import { redirect } from "next/navigation";
import { supabaseConfigured } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!supabaseConfigured()) redirect("/setup");
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Sign in to FormBridge</h1>
      <p className="mt-2 text-sm text-slate-600">We&apos;ll email you a one-time sign-in link. No password needed.</p>
      {error && <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <LoginForm next={next?.startsWith("/app") ? next : "/app"} />
    </main>
  );
}
