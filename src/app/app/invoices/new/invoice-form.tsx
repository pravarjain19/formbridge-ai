"use client";

import { useMemo, useState } from "react";
import { invoiceTotals, type ExportMode, type LineItemInput } from "@/lib/invoice";
import { buttonCls, Card, Field, inputCls } from "../../ui";

interface ClientOption {
  id: string;
  legal_name: string;
  po_required: boolean;
  payment_terms_days: number;
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function InvoiceForm({
  action,
  clients,
  suggestedNumber,
  today,
  gstRegistered,
}: {
  action: (fd: FormData) => Promise<void>;
  clients: ClientOption[];
  suggestedNumber: string;
  today: string;
  gstRegistered: boolean;
}) {
  const [clientId, setClientId] = useState(clients[0].id);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [mode, setMode] = useState<ExportMode>(gstRegistered ? "lut_without_igst" : "not_registered");
  const [currency, setCurrency] = useState("USD");
  const [fx, setFx] = useState(85);
  const [items, setItems] = useState<LineItemInput[]>([{ description: "", quantity: 1, unit_price_fcy: 0 }]);

  const client = clients.find((c) => c.id === clientId)!;
  const totals = useMemo(() => invoiceTotals(items, fx || 0, mode), [items, fx, mode]);
  const update = (i: number, patch: Partial<LineItemInput>) =>
    setItems((prev) => prev.map((it, n) => (n === i ? { ...it, ...patch } : it)));

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Client">
            <select name="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legal_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Invoice number" hint="Max 16 characters, unique per financial year.">
            <input name="invoice_number" defaultValue={suggestedNumber} maxLength={16} required className={`${inputCls} uppercase`} />
          </Field>
          <Field label={client.po_required ? "PO number (required)" : "PO number"}>
            <input name="po_number" required={client.po_required} className={inputCls} />
          </Field>
          <Field label="Invoice date">
            <input name="invoice_date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Due date">
            <input
              key={`${clientId}-${invoiceDate}`}
              name="due_date"
              type="date"
              defaultValue={addDays(invoiceDate, client.payment_terms_days)}
              className={inputCls}
            />
          </Field>
          <Field label="SAC code" hint="998314 = IT design & development; 998313 = IT consulting.">
            <input name="sac_code" defaultValue="998314" maxLength={6} required className={inputCls} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Line items</h2>
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_6rem_8rem_7rem_auto]">
              <input
                aria-label="Description"
                placeholder="Description of service"
                value={it.description}
                onChange={(e) => update(i, { description: e.target.value })}
                required
                className={inputCls}
              />
              <input
                aria-label="Quantity"
                type="number"
                min={0.001}
                step="any"
                value={it.quantity}
                onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                className={inputCls}
              />
              <input
                aria-label="Unit price"
                type="number"
                min={0}
                step="0.01"
                value={it.unit_price_fcy}
                onChange={(e) => update(i, { unit_price_fcy: Number(e.target.value) })}
                className={inputCls}
              />
              <p className="self-center text-right text-sm font-medium">
                {(it.quantity * it.unit_price_fcy).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <button
                type="button"
                onClick={() => setItems((p) => p.filter((_, n) => n !== i))}
                disabled={items.length === 1}
                className="text-sm text-red-700 disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems((p) => [...p, { description: "", quantity: 1, unit_price_fcy: 0 }])}
          className="mt-3 text-sm underline"
        >
          + Add line
        </button>
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Currency">
            <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
              {["USD", "EUR", "GBP", "CAD", "AUD", "SGD"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label={`Rate (₹ per ${currency})`}>
            <input name="fx_rate_inr" type="number" step="0.0001" min={0} value={fx} onChange={(e) => setFx(Number(e.target.value))} required className={inputCls} />
          </Field>
          <Field label="Rate source">
            <select name="fx_rate_source" defaultValue="rbi_reference" className={inputCls}>
              <option value="rbi_reference">RBI reference rate</option>
              <option value="cbic_notified">CBIC notified rate</option>
              <option value="sbi_tt_buying">SBI TT buying rate</option>
              <option value="bank_actual">Bank&apos;s actual rate</option>
              <option value="manual">Other</option>
            </select>
          </Field>
          <Field label="Rate date">
            <input name="fx_rate_date" type="date" defaultValue={invoiceDate} key={invoiceDate} required className={inputCls} />
          </Field>
          <Field label="GST treatment">
            <select name="export_mode" value={mode} onChange={(e) => setMode(e.target.value as ExportMode)} className={inputCls}>
              <option value="lut_without_igst">Export under LUT (0% IGST)</option>
              <option value="igst_paid_refund">Export with IGST paid (refund later)</option>
              <option value="not_registered">Not GST-registered</option>
            </select>
          </Field>
        </div>
        <dl className="mt-5 grid max-w-sm grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-500">Total ({currency})</dt>
          <dd className="text-right font-semibold">{totals.subtotalFcy.toLocaleString("en-US", { minimumFractionDigits: 2 })}</dd>
          <dt className="text-slate-500">Taxable value (INR)</dt>
          <dd className="text-right">₹{totals.subtotalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</dd>
          <dt className="text-slate-500">IGST ({totals.igstRatePct}%)</dt>
          <dd className="text-right">₹{totals.igstAmountInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</dd>
        </dl>
      </Card>

      <div className="flex gap-3">
        <button name="intent" value="issue" className={buttonCls}>
          Issue invoice
        </button>
        <button name="intent" value="draft" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium">
          Save as draft
        </button>
      </div>
    </form>
  );
}
