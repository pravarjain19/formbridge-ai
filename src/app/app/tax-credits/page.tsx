import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { ttRateDateFor } from "@/lib/tax/dates";
import { summariseFtc } from "@/lib/tax/ftc";
import { Badge, buttonCls, Card, Field, Flash, fmtInr, fmtUsd, inputCls, PageTitle } from "../ui";
import { addDeduction, addSlip, deleteDeduction } from "./actions";

const DEFAULT_RATE = 31.2;

interface Deduction {
  id: string;
  deducted_on: string;
  financial_year: string;
  gross_usd: number;
  tax_usd: number;
  sbi_tt_rate: number | null;
  tax_inr: number | null;
}

export default async function TaxCreditsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireUser();
  const sp = await searchParams;
  const [{ data: slips }, { data: clients }] = await Promise.all([
    supabase
      .from("tax_withholdings")
      .select(
        "id, us_tax_year, withholding_agent_name, income_code, gross_income_usd, federal_tax_withheld_usd, ftc_status, ch3_tax_rate_pct, withholding_deductions(id, deducted_on, financial_year, gross_usd, tax_usd, sbi_tt_rate, tax_inr)",
      )
      .order("us_tax_year", { ascending: false }),
    supabase.from("clients").select("id, legal_name").order("legal_name"),
  ]);

  const allDeductions = (slips ?? []).flatMap((s) => (s.withholding_deductions ?? []) as Deduction[]);
  const rateFor = (fy: string) => Number(sp[`rate_${fy}`] ?? DEFAULT_RATE);
  const summary = summariseFtc(allDeductions, rateFor);

  return (
    <>
      <PageTitle title="Foreign tax credits" />
      <Flash error={sp.error} />

      <Card>
        <h2 className="font-semibold">Credit by Indian financial year</h2>
        <p className="mt-1 text-sm text-slate-600">
          The credit is the lower of the US tax paid and the Indian tax on the same income. File Form 67 (income up to FY
          2025-26) or Form 44 (FY 2026-27 onwards) on the income-tax portal before you file the ITR.
        </p>
        {summary.length ? (
          <form className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="pb-2">FY</th>
                  <th className="pb-2">Form</th>
                  <th className="pb-2 text-right">US income</th>
                  <th className="pb-2 text-right">US tax</th>
                  <th className="pb-2 text-right">Your Indian rate %</th>
                  <th className="pb-2 text-right">Indian tax on it</th>
                  <th className="pb-2 text-right">Credit</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.financialYear} className="border-t border-slate-100">
                    <td className="py-2 font-medium">{s.financialYear}</td>
                    <td className="py-2">{s.form}</td>
                    <td className="py-2 text-right">
                      {fmtUsd(s.incomeUsd)}
                      <span className="block text-xs text-slate-500">{fmtInr(s.incomeInr)}</span>
                    </td>
                    <td className="py-2 text-right">
                      {fmtUsd(s.taxUsd)}
                      <span className="block text-xs text-slate-500">{fmtInr(s.foreignTaxInr)}</span>
                    </td>
                    <td className="py-2 text-right">
                      <input
                        name={`rate_${s.financialYear}`}
                        type="number"
                        step="0.1"
                        min={0}
                        max={50}
                        defaultValue={rateFor(s.financialYear)}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right"
                      />
                    </td>
                    <td className="py-2 text-right">{fmtInr(s.indianTaxInr)}</td>
                    <td className="py-2 text-right font-semibold">{fmtInr(s.ftcInr)}</td>
                    <td className="py-2 text-right">
                      <Link
                        className="underline"
                        href={`/app/tax-credits/export?fy=${s.financialYear}&rate=${rateFor(s.financialYear)}`}
                      >
                        CSV
                      </Link>
                      {s.missingRates > 0 && <Badge tone="amber">{s.missingRates} without TT rate</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="mt-3 text-sm underline">Recalculate with these rates</button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Add the individual deductions under each slip below to see the credit by financial year.
          </p>
        )}
      </Card>

      {(slips ?? []).map((s) => {
        const rows = ((s.withholding_deductions ?? []) as Deduction[]).sort((a, b) => a.deducted_on.localeCompare(b.deducted_on));
        const allocated = rows.reduce((t, r) => t + Number(r.tax_usd), 0);
        const remaining = Math.round((Number(s.federal_tax_withheld_usd) - allocated) * 100) / 100;
        return (
          <Card key={s.id} className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">
                  {s.us_tax_year} · {s.withholding_agent_name ?? "Withholding agent"}
                </h3>
                <p className="text-sm text-slate-600">
                  Gross {fmtUsd(s.gross_income_usd)} · US tax {fmtUsd(s.federal_tax_withheld_usd)}
                  {s.ch3_tax_rate_pct != null && ` (${Number(s.ch3_tax_rate_pct)}%)`}
                  {s.income_code && ` · income code ${s.income_code}`}
                </p>
              </div>
              <Badge tone={s.ftc_status === "ready" ? "green" : s.ftc_status === "not_applicable" ? "slate" : "amber"}>
                {s.ftc_status.replace("_", " ")}
              </Badge>
            </div>

            {s.ftc_status !== "not_applicable" && (
              <>
                <table className="mt-4 w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="pb-1">Deducted on</th>
                      <th className="pb-1">FY</th>
                      <th className="pb-1 text-right">Gross</th>
                      <th className="pb-1 text-right">Tax</th>
                      <th className="pb-1 text-right">SBI TT rate</th>
                      <th className="pb-1 text-right">Tax (INR)</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="py-1">{r.deducted_on}</td>
                        <td className="py-1">{r.financial_year}</td>
                        <td className="py-1 text-right">{fmtUsd(r.gross_usd)}</td>
                        <td className="py-1 text-right">{fmtUsd(r.tax_usd)}</td>
                        <td className="py-1 text-right">{r.sbi_tt_rate ?? "—"}</td>
                        <td className="py-1 text-right">{fmtInr(r.tax_inr)}</td>
                        <td className="py-1 text-right">
                          <form action={deleteDeduction.bind(null, s.id, r.id)}>
                            <button className="text-xs text-red-700">Remove</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {remaining !== 0 && (
                  <p className="mt-2 text-sm text-amber-800">
                    {remaining > 0
                      ? `${fmtUsd(remaining)} of Box 7a is not yet split into dated deductions.`
                      : `Deductions exceed Box 7a by ${fmtUsd(-remaining)}.`}
                  </p>
                )}
                <form action={addDeduction.bind(null, s.id)} className="mt-3 grid gap-3 sm:grid-cols-5">
                  <Field label="Deducted on" hint="Use the payment date on the remittance advice.">
                    <input name="deducted_on" type="date" required className={inputCls} />
                  </Field>
                  <Field label="Gross paid (USD)">
                    <input name="gross_usd" type="number" step="0.01" min={0} required className={inputCls} />
                  </Field>
                  <Field label="Tax withheld (USD)">
                    <input name="tax_usd" type="number" step="0.01" min={0} required defaultValue={remaining > 0 ? remaining : undefined} className={inputCls} />
                  </Field>
                  <Field label="SBI TT buying rate" hint="Rate on the last day of the previous month.">
                    <input name="sbi_tt_rate" type="number" step="0.0001" min={0} className={inputCls} />
                  </Field>
                  <div className="self-end">
                    <button className={buttonCls}>Add</button>
                  </div>
                </form>
                {rows.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Example: tax deducted on {rows[rows.length - 1].deducted_on} uses the SBI TT buying rate of{" "}
                    {ttRateDateFor(rows[rows.length - 1].deducted_on)}.
                  </p>
                )}
              </>
            )}
          </Card>
        );
      })}

      <Card className="mt-6">
        <h2 className="mb-1 font-semibold">Add a slip manually</h2>
        <p className="mb-4 text-sm text-slate-600">
          Or upload the 1042-S on the{" "}
          <Link href="/app/documents" className="underline">
            Documents
          </Link>{" "}
          page and it is added automatically.
        </p>
        <form action={addSlip} className="grid gap-4 sm:grid-cols-3">
          <Field label="US tax year">
            <input name="us_tax_year" type="number" defaultValue={new Date().getFullYear() - 1} required className={inputCls} />
          </Field>
          <Field label="Withholding agent (client)">
            <input name="withholding_agent_name" required className={inputCls} />
          </Field>
          <Field label="Client">
            <select name="client_id" className={inputCls}>
              <option value="">—</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legal_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Income code (Box 1)">
            <input name="income_code" placeholder="17" className={inputCls} />
          </Field>
          <Field label="Gross income (Box 2, USD)">
            <input name="gross_income_usd" type="number" step="0.01" min={0} required className={inputCls} />
          </Field>
          <Field label="US tax withheld (Box 7a, USD)">
            <input name="federal_tax_withheld_usd" type="number" step="0.01" min={0} required className={inputCls} />
          </Field>
          <div>
            <button className={buttonCls}>Add slip</button>
          </div>
        </form>
      </Card>
    </>
  );
}
