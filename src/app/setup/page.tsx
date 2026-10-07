export default function SetupPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">Connect Supabase to use the dashboard</h1>
      <p className="mt-2 text-slate-600">
        The calculator and the document check work without an account. Clients, invoices, uploads and tax credits need
        a Supabase project (the free plan is enough).
      </p>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm">
        <li>Create a project at supabase.com.</li>
        <li>In the SQL editor, run <code>supabase/schema.sql</code> from this repo.</li>
        <li>
          In Project Settings → API Keys, copy the project URL and the publishable key into <code>.env.local</code> as{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> (older projects:{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>).
        </li>
        <li>
          In Authentication → URL Configuration, add <code>http://localhost:3000/auth/callback</code> to the redirect
          URLs.
        </li>
        <li>Restart <code>npm run dev</code>.</li>
      </ol>
    </main>
  );
}
