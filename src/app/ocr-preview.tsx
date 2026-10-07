"use client";

import { useState } from "react";
import type { OcrExtraction } from "@/lib/ocr/schema";
import type { ValidationIssue } from "@/lib/ocr/validate";

interface PreviewResponse {
  provider: string;
  model: string;
  extraction: OcrExtraction;
  issues: ValidationIssue[];
}

const SEVERITY_STYLE: Record<ValidationIssue["severity"], string> = {
  error: "border-red-300 bg-red-50 text-red-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-slate-300 bg-white text-slate-700",
};

export function OcrPreview() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResponse | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ocr/preview", { method: "POST", body: new FormData(e.currentTarget) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const f = result?.extraction.form_1042s;
  const r = result?.extraction.remittance;

  return (
    <section className="mt-8 space-y-6">
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="text-sm font-medium">Document (PDF, PNG, JPG, WebP; max 20 MB)</span>
          <input
            name="file"
            type="file"
            required
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-white"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Document type</span>
            <select name="docType" className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
              <option value="">Detect automatically</option>
              <option value="form_1042s">Form 1042-S</option>
              <option value="form_1099_nec">Form 1099-NEC</option>
              <option value="remittance_advice">Payment / remittance advice</option>
              <option value="firc">Bank FIRC</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Where did you do the work?</span>
            <select name="servicesInUs" className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
              <option value="false">Entirely outside the US</option>
              <option value="true">Partly or fully in the US</option>
            </select>
          </label>
        </div>
        <button
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Reading document…" : "Check document"}
        </button>
        <p className="text-xs text-slate-500">
          Test with sample or masked documents only. Nothing is saved, but the file is sent to the configured AI provider.
        </p>
      </form>

      {error && <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">Error: {error}</p>}

      {result && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Read by <b>{result.provider}</b> ({result.model}) · detected <b>{result.extraction.detected_doc_type}</b> ·
            confidence {(result.extraction.overall_confidence * 100).toFixed(0)}%
            {result.provider === "mock" && " · sample data, not your file"}
          </p>

          <div className="space-y-2">
            {result.issues.length === 0 && (
              <p className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">No problems found.</p>
            )}
            {result.issues.map((i, n) => (
              <div key={n} className={`rounded-md border p-3 text-sm ${SEVERITY_STYLE[i.severity]}`}>
                <b className="uppercase">{i.severity}</b> · {i.message}
              </div>
            ))}
          </div>

          {f && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white p-5 text-sm">
              <Row k="Tax year" v={f.tax_year} />
              <Row k="Withholding agent" v={f.box12d_withholding_agent_name} />
              <Row k="Income code (Box 1)" v={f.box1_income_code} />
              <Row k="Gross income (Box 2)" v={usd(f.box2_gross_income)} />
              <Row k="Exemption code (Box 3a)" v={f.box3a_ch3_exemption_code} />
              <Row k="Tax rate (Box 3b)" v={f.box3b_ch3_tax_rate == null ? null : `${f.box3b_ch3_tax_rate}%`} />
              <Row k="US tax withheld (Box 7a)" v={usd(f.box7a_federal_tax_withheld)} />
              <Row k="Recipient country (Box 13b)" v={f.box13b_recipient_country_code} />
            </dl>
          )}
          {r && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white p-5 text-sm">
              <Row k="Payer" v={r.payer_name} />
              <Row k="Payment date" v={r.payment_date} />
              <Row k="Gross" v={money(r.gross_amount, r.currency)} />
              <Row k="Tax withheld" v={money(r.tax_withheld_amount, r.currency)} />
              <Row k="Fees" v={money(r.fees_deducted_amount, r.currency)} />
              <Row k="Net paid" v={money(r.net_amount_paid, r.currency)} />
              <Row k="Invoices" v={r.invoice_numbers_referenced.join(", ") || null} />
              <Row k="Purpose code" v={r.purpose_code} />
            </dl>
          )}

          <details className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
            <summary className="cursor-pointer text-sm font-medium">Full extracted JSON</summary>
            <pre className="mt-3 overflow-x-auto">{JSON.stringify(result.extraction, null, 2)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <>
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-medium">{v ?? "—"}</dd>
    </>
  );
}

const usd = (n: number | null) => money(n, "USD");
function money(n: number | null, currency: string | null) {
  if (n == null) return null;
  return `${currency ?? ""} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}
