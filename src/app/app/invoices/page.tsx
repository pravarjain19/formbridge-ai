import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { Badge, buttonCls, Card, fmtInr, PageTitle } from "../ui";

const TONE = { draft: "slate", issued: "amber", partially_paid: "amber", paid: "green", void: "red" } as const;

export default async function InvoicesPage() {
  const { supabase } = await requireUser();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, invoice_date, currency, subtotal_fcy, subtotal_inr, status, clients(legal_name)")
    .order("invoice_date", { ascending: false })
    .limit(200);

  return (
    <>
      <PageTitle title="Invoices">
        <Link href="/app/invoices/new" className={buttonCls}>
          New invoice
        </Link>
      </PageTitle>
      <Card>
        {invoices?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="pb-2">Number</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Client</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-right">INR value</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="py-2">
                      <Link href={`/app/invoices/${i.id}`} className="font-medium underline">
                        {i.invoice_number}
                      </Link>
                    </td>
                    <td className="py-2">{i.invoice_date}</td>
                    <td className="py-2">{(i.clients as unknown as { legal_name: string } | null)?.legal_name}</td>
                    <td className="py-2 text-right">
                      {i.currency} {Number(i.subtotal_fcy).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 text-right">{fmtInr(i.subtotal_inr)}</td>
                    <td className="py-2">
                      <Badge tone={TONE[i.status as keyof typeof TONE]}>{i.status.replace("_", " ")}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No invoices yet.</p>
        )}
      </Card>
    </>
  );
}
