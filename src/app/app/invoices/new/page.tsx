import Link from "next/link";
import { nextInvoiceNumber } from "@/lib/invoice";
import { requireUser } from "@/lib/supabase/server";
import { indianFy, todayIso } from "@/lib/tax/dates";
import { Card, Flash, PageTitle } from "../../ui";
import { createInvoice } from "../actions";
import { InvoiceForm } from "./invoice-form";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireUser();
  const { error } = await searchParams;
  const today = todayIso();
  const fy = indianFy(today);

  const [{ data: clients }, { data: numbers }, { data: profile }, { data: lut }] = await Promise.all([
    supabase.from("clients").select("id, legal_name, po_required, payment_terms_days").order("legal_name"),
    supabase.from("invoices").select("invoice_number").eq("financial_year", fy),
    supabase.from("profiles").select("gstin").single(),
    supabase.from("lut_registrations").select("arn").eq("financial_year", fy).maybeSingle(),
  ]);

  if (!clients?.length) {
    return (
      <>
        <PageTitle title="New invoice" />
        <Card>
          <p className="text-sm">
            Add a client first.{" "}
            <Link href="/app/clients" className="underline">
              Go to clients
            </Link>
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageTitle title="New invoice" />
      <Flash error={error} />
      {profile?.gstin && !lut && (
        <Flash error={`No LUT recorded for FY ${fy}. You can save drafts, but add the LUT in Settings before issuing zero-rated invoices.`} />
      )}
      <InvoiceForm
        action={createInvoice}
        clients={clients}
        suggestedNumber={nextInvoiceNumber((numbers ?? []).map((n) => n.invoice_number), fy)}
        today={today}
        gstRegistered={Boolean(profile?.gstin)}
      />
    </>
  );
}
