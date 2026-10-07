"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod/v4";
import { gstDeclaration, invoiceTotals, validateInvoiceNumber } from "@/lib/invoice";
import { requireUser } from "@/lib/supabase/server";
import { indianFy } from "@/lib/tax/dates";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);
const fail = (path: string, msg: string): never => redirect(`${path}?error=${encodeURIComponent(msg)}`);

const LineItem = z.object({
  description: z.string().trim().min(1, "Every line needs a description").max(500),
  sac_code: z.string().trim().max(8).nullable().optional(),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unit_price_fcy: z.coerce.number().min(0, "Price cannot be negative"),
});

const InvoiceForm = z.object({
  client_id: z.uuid("Choose a client"),
  invoice_number: z.string(),
  invoice_date: z.iso.date("Invoice date is required"),
  due_date: z.iso.date().nullable(),
  po_number: z.string().max(100).nullable(),
  export_mode: z.enum(["lut_without_igst", "igst_paid_refund", "not_registered"]),
  sac_code: z.string().regex(/^[0-9]{6}$/, "SAC code must be 6 digits"),
  currency: z.enum(["USD", "EUR", "GBP", "CAD", "AUD", "SGD"]),
  fx_rate_inr: z.coerce.number().positive("Exchange rate is required"),
  fx_rate_source: z.enum(["rbi_reference", "cbic_notified", "sbi_tt_buying", "bank_actual", "manual"]),
  fx_rate_date: z.iso.date("Exchange-rate date is required"),
  items: z.array(LineItem).min(1, "Add at least one line item"),
  issue: z.boolean(),
});

export async function createInvoice(fd: FormData) {
  const { supabase, user } = await requireUser();
  let items: unknown = [];
  try {
    items = JSON.parse(String(fd.get("items") ?? "[]"));
  } catch {
    fail("/app/invoices/new", "Line items could not be read");
  }

  const parsed = InvoiceForm.safeParse({
    client_id: fd.get("client_id"),
    invoice_number: (str(fd.get("invoice_number")) ?? "").toUpperCase(),
    invoice_date: fd.get("invoice_date"),
    due_date: str(fd.get("due_date")),
    po_number: str(fd.get("po_number")),
    export_mode: fd.get("export_mode"),
    sac_code: str(fd.get("sac_code")) ?? "",
    currency: fd.get("currency"),
    fx_rate_inr: fd.get("fx_rate_inr"),
    fx_rate_source: fd.get("fx_rate_source"),
    fx_rate_date: fd.get("fx_rate_date"),
    items,
    issue: fd.get("intent") === "issue",
  });
  if (!parsed.success) fail("/app/invoices/new", parsed.error.issues[0].message);
  const f = parsed.data!;
  const numberError = validateInvoiceNumber(f.invoice_number);
  if (numberError) fail("/app/invoices/new", numberError);

  const { data: client } = await supabase.from("clients").select("po_required").eq("id", f.client_id).maybeSingle();
  if (!client) fail("/app/invoices/new", "Client not found");
  if (client!.po_required && !f.po_number && f.issue) fail("/app/invoices/new", "This client requires a PO number");

  const fy = indianFy(f.invoice_date);
  let lutId: string | null = null;
  if (f.export_mode === "lut_without_igst") {
    const { data: lut } = await supabase.from("lut_registrations").select("id").eq("financial_year", fy).maybeSingle();
    lutId = lut?.id ?? null;
    if (!lutId && f.issue) {
      fail("/app/invoices/new", `No LUT recorded for FY ${fy}. Add it in Settings, or save this invoice as a draft.`);
    }
  }

  const totals = invoiceTotals(f.items, f.fx_rate_inr, f.export_mode);
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      client_id: f.client_id,
      invoice_number: f.invoice_number,
      invoice_date: f.invoice_date,
      due_date: f.due_date,
      po_number: f.po_number,
      export_mode: f.export_mode,
      lut_id: lutId,
      sac_code: f.sac_code,
      currency: f.currency,
      subtotal_fcy: totals.subtotalFcy,
      fx_rate_inr: f.fx_rate_inr,
      fx_rate_source: f.fx_rate_source,
      fx_rate_date: f.fx_rate_date,
      igst_rate_pct: totals.igstRatePct,
      igst_amount_inr: totals.igstAmountInr,
      gst_declaration: gstDeclaration(f.export_mode),
      status: f.issue ? "issued" : "draft",
      issued_at: f.issue ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) {
    fail("/app/invoices/new", error.code === "23505" ? `Invoice number ${f.invoice_number} is already used in FY ${fy}` : error.message);
  }

  const { error: itemsError } = await supabase.from("invoice_line_items").insert(
    f.items.map((it, position) => ({
      invoice_id: invoice!.id,
      user_id: user.id,
      position,
      description: it.description,
      sac_code: it.sac_code || null,
      quantity: it.quantity,
      unit_price_fcy: it.unit_price_fcy,
    })),
  );
  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice!.id); // keep invoice + items all-or-nothing
    fail("/app/invoices/new", itemsError.message);
  }

  revalidatePath("/app/invoices");
  revalidatePath("/app");
  redirect(`/app/invoices/${invoice!.id}`);
}

export async function setInvoiceStatus(id: string, status: "issued" | "void") {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("invoices")
    .update({ status, ...(status === "issued" ? { issued_at: new Date().toISOString() } : {}) })
    .eq("id", id);
  if (error) {
    const msg = error.message.includes("lut_requires_ref")
      ? "Record your LUT for this financial year in Settings before issuing."
      : error.message;
    fail(`/app/invoices/${id}`, msg);
  }
  revalidatePath(`/app/invoices/${id}`);
  redirect(`/app/invoices/${id}`);
}

const PaymentForm = z.object({
  received_on: z.iso.date("Date received is required"),
  amount_fcy: z.coerce.number().positive("Amount is required"),
  intermediary_fees_fcy: z.coerce.number().min(0),
  amount_inr_credited: z.coerce.number().min(0, "INR credited is required"),
  rbi_purpose_code: z.string().max(10).nullable(),
  firc_number: z.string().max(100).nullable(),
  bank_reference: z.string().max(100).nullable(),
});

export async function recordPayment(invoiceId: string, fd: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = PaymentForm.safeParse({
    received_on: fd.get("received_on"),
    amount_fcy: fd.get("amount_fcy"),
    intermediary_fees_fcy: str(fd.get("intermediary_fees_fcy")) ?? "0",
    amount_inr_credited: fd.get("amount_inr_credited"),
    rbi_purpose_code: str(fd.get("rbi_purpose_code")),
    firc_number: str(fd.get("firc_number")),
    bank_reference: str(fd.get("bank_reference")),
  });
  if (!parsed.success) fail(`/app/invoices/${invoiceId}`, parsed.error.issues[0].message);

  const { data: inv } = await supabase
    .from("invoices")
    .select("client_id, currency, subtotal_fcy, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) fail(`/app/invoices/${invoiceId}`, "Invoice not found");
  if (inv!.status === "void" || inv!.status === "draft") fail(`/app/invoices/${invoiceId}`, "Issue the invoice before recording payments");

  const { error } = await supabase.from("payments").insert({
    ...parsed.data!,
    user_id: user.id,
    invoice_id: invoiceId,
    client_id: inv!.client_id,
    currency: inv!.currency,
  });
  if (error) fail(`/app/invoices/${invoiceId}`, error.message);

  const { data: pays } = await supabase.from("payments").select("amount_fcy").eq("invoice_id", invoiceId);
  const received = (pays ?? []).reduce((s, p) => s + Number(p.amount_fcy), 0);
  await supabase
    .from("invoices")
    .update({ status: received + 0.005 >= Number(inv!.subtotal_fcy) ? "paid" : "partially_paid" })
    .eq("id", invoiceId);

  revalidatePath(`/app/invoices/${invoiceId}`);
  revalidatePath("/app");
  redirect(`/app/invoices/${invoiceId}`);
}
