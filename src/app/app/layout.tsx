import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/app", label: "Overview" },
  { href: "/app/clients", label: "Clients & W-8" },
  { href: "/app/invoices", label: "Invoices" },
  { href: "/app/documents", label: "Documents" },
  { href: "/app/tax-credits", label: "Tax credits" },
  { href: "/app/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
      <aside className="md:w-52 md:shrink-0">
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-500">
          <p className="truncate">{user.email}</p>
          <button className="mt-1 underline">Sign out</button>
        </form>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
