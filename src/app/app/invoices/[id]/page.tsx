import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { buttonCls, Card, Field, Flash, fmtInr, inputCls } from "../../ui";
import { recordPayment, setInvoiceStatus } from "../actions";
import { PrintButton } from "./print-button";

type Addr = { line?: string | null; city?: string | null; state?: string | null; zip?: string | null; pincode?: string | null; country?: string | null };
const addrLines = (a: Addr | null) =>
  [a?.line, [a?.city, a?.state, a?.zip ?? a?.pincode].filter(Boolean).join(", "), a?.country].filter(Boolean) as string[];

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user } = await requireUser();

  const [{ data: inv }, { data: items }, { data: profile }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("*, clients(*), lut_registrations(arn, financial_year)").eq("id", id).maybeSingle(),
    supabase.from("invoice_line_items").select("*").eq("invoice_id", id).order("position"),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("payments").select("*").eq("invoice_id", id).order("received_on"),
  ]);
  if (!inv) notFound();
  const { data: w8 } = await supabase
    .from("w8_certifications")
    .select("form_type, expires_on")
    .eq("client_id", inv.client_id)
    .order("expires_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  const client = inv.clients as Record<string, unknown> & { legal_name: string; address: Addr; vendor_id: string | null; us_ein: string | null };
  const lut = inv.lut_registrations as { arn: string } | null;
  const money = (n: number) => `${inv.currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const received = (payments ?? []).reduce((s, p) => s + Number(p.amount_fcy), 0);

  return (
    <>
      <Flash error={error} />
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <PrintButton />
        {inv.status === "draft" && (
          <form action={setInvoiceStatus.bind(null, id, "issued")}>
            <button className={buttonCls}>Issue invoice</button>
          </form>
        )}
        {inv.status !== "void" && inv.status !== "paid" && (
          <form action={setInvoiceStatus.bind(null, id, "void")}>
            <button className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm text-red-700">Void</button>
          </form>
        )}
      </div>

      {/* The printable invoice */}
      <article className="rounded-xl border border-slate-200 bg-white p-8 text-sm shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap justify-between gap-6">
          <div>
            <h1 className="text-xl font-bold">{profile?.trade_name || profile?.legal_name || "Your business name"}</h1>
            {profile?.trade_name && <p>{profile.legal_name}</p>}
            {addrLines(profile?.address as Addr).map((l) => (
              <p key={l}>{l}</p>
            ))}
            {profile?.gstin && <p>GSTIN: {profile.gstin}</p>}
            {profile?.pan_masked && <p>PAN: {profile.pan_masked}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-wide">
              {inv.export_mode === "not_registered" ? "INVOICE" : "TAX INVOICE"}
            </p>
            <p>
              No. <b>{inv.invoice_number}</b>
            </p>
            <p>Date: {inv.invoice_date}</p>
            {inv.due_date && <p>Due: {inv.due_date}</p>}
            {inv.po_number && <p>PO: {inv.po_number}</p>}
            {inv.status === "void" && <p className="font-bold text-red-700">VOID</p>}
          </div>
        </header>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate-500">Bill to</p>
            <p className="font-semibold">{client.legal_name}</p>
            {addrLines(client.address).map((l) => (
              <p key={l}>{l}</p>
            ))}
            <p>{String(client.country_code)}</p>
            {client.us_ein && <p>EIN: {client.us_ein}</p>}
            {client.vendor_id && <p>Vendor ID: {client.vendor_id}</p>}
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Supply details</p>
            <p>Place of supply: {inv.place_of_supply}</p>
            <p>SAC: {inv.sac_code}</p>
            <p>
              Exchange rate: ₹{Number(inv.fx_rate_inr).toFixed(4)} / {inv.currency} ({String(inv.fx_rate_source).replace(/_/g, " ")},{" "}
              {inv.fx_rate_date})
            </p>
          </div>
        </section>

        <table className="mt-6 w-full">
          <thead className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="py-2">{it.description}</td>
                <td className="py-2 text-right">{Number(it.quantity)}</td>
                <td className="py-2 text-right">{money(it.unit_price_fcy)}</td>
                <td className="py-2 text-right">{money(it.amount_fcy)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 grid max-w-xs grid-cols-2 gap-y-1">
          <dt>Total</dt>
          <dd className="text-right font-bold">{money(inv.subtotal_fcy)}</dd>
          <dt className="text-slate-500">Taxable value (INR)</dt>
          <dd className="text-right">{fmtInr(inv.subtotal_inr)}</dd>
          <dt className="text-slate-500">IGST @ {Number(inv.igst_rate_pct)}%</dt>
          <dd className="text-right">{fmtInr(inv.igst_amount_inr)}</dd>
        </dl>

        {inv.gst_declaration && (
          <p className="mt-6 border-t border-slate-200 pt-4 font-semibold">
            {inv.gst_declaration}
            {lut && <span className="block font-normal">LUT ARN: {lut.arn}</span>}
          </p>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Export of services. Payee is a non-US person
          {w8 && w8.expires_on >= inv.invoice_date ? `; Form ${w8.form_type} on file with the client` : ""}.
          {!client.services_performed_in_us && " Services performed outside the United States."}
        </p>
      </article>

      {inv.status !== "draft" && inv.status !== "void" && (
        <Card className="mt-6 print:hidden">
          <h2 className="font-semibold">Payments received</h2>
          <p className="mt-1 text-sm text-slate-600">
            Received {money(received)} of {money(inv.subtotal_fcy)}. Record each bank credit with its FIRC / e-BRC number;
            you need these for GST refunds and income-tax reconciliation.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {(payments ?? []).map((p) => (
              <li key={p.id}>
                {p.received_on}: {money(p.amount_fcy)} (fees {money(p.intermediary_fees_fcy)}) → {fmtInr(p.amount_inr_credited)}
                {p.effective_fx_rate && ` @ ₹${Number(p.effective_fx_rate).toFixed(2)}`}
                {p.firc_number && ` · FIRC ${p.firc_number}`}
              </li>
            ))}
          </ul>
          {inv.status !== "paid" && (
            <form action={recordPayment.bind(null, id)} className="mt-4 grid gap-4 sm:grid-cols-4">
              <Field label="Date credited">
                <input name="received_on" type="date" required className={inputCls} />
              </Field>
              <Field label={`Amount (${inv.currency})`}>
                <input name="amount_fcy" type="number" step="0.01" min={0} defaultValue={Number(inv.subtotal_fcy) - received} required className={inputCls} />
              </Field>
              <Field label={`Fees deducted (${inv.currency})`}>
                <input name="intermediary_fees_fcy" type="number" step="0.01" min={0} defaultValue={0} className={inputCls} />
              </Field>
              <Field label="INR credited to bank">
                <input name="amount_inr_credited" type="number" step="0.01" min={0} required className={inputCls} />
              </Field>
              <Field label="Purpose code">
                <input name="rbi_purpose_code" defaultValue="P0802" className={inputCls} />
              </Field>
              <Field label="FIRC / e-BRC number">
                <input name="firc_number" className={inputCls} />
              </Field>
              <Field label="Bank reference">
                <input name="bank_reference" className={inputCls} />
              </Field>
              <div className="self-end">
                <button className={buttonCls}>Record payment</button>
              </div>
            </form>
          )}
        </Card>
      )}
    </>
  );
}
