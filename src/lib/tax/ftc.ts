import { ftcFormForFy } from "./dates";

/**
 * Foreign Tax Credit per Indian FY (Rule 128 / Rule 76): credit is the lower of
 * (a) foreign tax paid on the income and (b) Indian tax attributable to that
 * income, computed source-by-source. Amounts are converted at the SBI TT buying
 * rate on the last day of the month before each deduction.
 */

export interface DeductionRow {
  financial_year: string;
  gross_usd: number;
  tax_usd: number;
  sbi_tt_rate: number | null;
}

export interface FySummary {
  financialYear: string;
  form: "Form 67" | "Form 44";
  incomeUsd: number;
  taxUsd: number;
  incomeInr: number;
  foreignTaxInr: number;
  indianTaxInr: number;
  ftcInr: number;
  /** Deductions still missing an SBI TT rate; INR figures exclude them. */
  missingRates: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function summariseFtc(rows: DeductionRow[], indianRatePctFor: (fy: string) => number): FySummary[] {
  const byFy = new Map<string, DeductionRow[]>();
  for (const r of rows) byFy.set(r.financial_year, [...(byFy.get(r.financial_year) ?? []), r]);

  return [...byFy.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([fy, list]) => {
      const priced = list.filter((r) => r.sbi_tt_rate && r.sbi_tt_rate > 0);
      const incomeInr = r2(priced.reduce((s, r) => s + Number(r.gross_usd) * Number(r.sbi_tt_rate), 0));
      const foreignTaxInr = r2(priced.reduce((s, r) => s + Number(r.tax_usd) * Number(r.sbi_tt_rate), 0));
      const rate = Math.min(50, Math.max(0, indianRatePctFor(fy) || 0));
      const indianTaxInr = r2((incomeInr * rate) / 100);
      return {
        financialYear: fy,
        form: ftcFormForFy(fy),
        incomeUsd: r2(list.reduce((s, r) => s + Number(r.gross_usd), 0)),
        taxUsd: r2(list.reduce((s, r) => s + Number(r.tax_usd), 0)),
        incomeInr,
        foreignTaxInr,
        indianTaxInr,
        ftcInr: Math.min(foreignTaxInr, indianTaxInr),
        missingRates: list.length - priced.length,
      };
    });
}
