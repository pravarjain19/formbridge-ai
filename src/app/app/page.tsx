import Link from "next/link";
import { daysUntil, indianFy, todayIso } from "@/lib/tax/dates";
import { requireUser } from "@/lib/supabase/server";
import { Card, fmtInr, fmtUsd, PageTitle } from "./ui";

export default async function Overview() {
  const { supabase, user } = await requireUser();
  const fy = indianFy(todayIso());

  const [profile, lut, invoices, w8s, docs, withholdings] = await Promise.all([
    supabase.from("profiles").select("legal_name, gstin").eq("id", user.id).single(),
    supabase.from("lut_registrations").select("arn").eq("financial_year", fy).maybeSingle(),
    supabase.from("invoices").select("subtotal_fcy, subtotal_inr, status").eq("financial_year", fy).neq("status", "void"),
    supabase.from("w8_certifications").select("expires_on, clients(legal_name)").order("expires_on"),
    supabase.from("documents").select("id").eq("status", "needs_review"),
    supabase.from("tax_withholdings").select("federal_tax_withheld_usd, ftc_status"),
  ]);

  const billedUsd = (invoices.data ?? []).reduce((s, i) => s + Number(i.subtotal_fcy), 0);
  const billedInr = (invoices.data ?? []).reduce((s, i) => s + Number(i.subtotal_inr), 0);
  const unpaid = (invoices.data ?? []).filter((i) => i.status === "issued" || i.status === "partially_paid").length;
  const expiringW8 = (w8s.data ?? []).filter((w) => daysUntil(w.expires_on) <= 90);
  const pendingFtc = (withholdings.data ?? []).filter((w) => w.ftc_status === "pending");

  const todos: { text: string; href: string }[] = [];
  if (!profile.data?.legal_name) todos.push({ text: "Add your business details", href: "/app/settings" });
  if (profile.data?.gstin && !lut.data) todos.push({ text: `File and record your LUT for FY ${fy}`, href: "/app/settings" });
  for (const w of expiringW8) {
    const client = (w.clients as unknown as { legal_name: string } | null)?.legal_name ?? "a client";
    const d = daysUntil(w.expires_on);
    todos.push({ text: `W-8 for ${client} ${d < 0 ? "has expired" : `expires in ${d} days`}: send a new one`, href: "/app/clients" });
  }
  if (docs.data?.length) todos.push({ text: `${docs.data.length} document(s) need review`, href: "/app/documents" });
  if (pendingFtc.length) todos.push({ text: `${pendingFtc.length} US tax slip(s) need FTC details`, href: "/app/tax-credits" });

  return (
    <>
      <PageTitle title={`Overview · FY ${fy}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Billed this FY</p>
          <p className="text-2xl font-bold">{fmtUsd(billedUsd)}</p>
          <p className="text-sm text-slate-500">{fmtInr(billedInr)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Unpaid invoices</p>
          <p className="text-2xl font-bold">{unpaid}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">LUT for FY {fy}</p>
          <p className="text-2xl font-bold">{lut.data ? "On file" : "Missing"}</p>
          {lut.data && <p className="text-sm text-slate-500">ARN {lut.data.arn}</p>}
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="mb-3 font-semibold">To do</h2>
        {todos.length ? (
          <ul className="space-y-2 text-sm">
            {todos.map((t, i) => (
              <li key={i}>
                <Link href={t.href} className="underline">
                  {t.text}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">You&apos;re all caught up.</p>
        )}
      </Card>
    </>
  );
}
