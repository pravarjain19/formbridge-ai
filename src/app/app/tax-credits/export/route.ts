import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ftcFormForFy } from "@/lib/tax/dates";

/**
 * GET /app/tax-credits/export?fy=2026-27&rate=31.2
 * CSV of the figures Form 67 / Form 44 asks for, one row per deduction plus a total.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fy = url.searchParams.get("fy") ?? "";
  const rate = Math.min(50, Math.max(0, Number(url.searchParams.get("rate") ?? "0") || 0));
  if (!/^[0-9]{4}-[0-9]{2}$/.test(fy)) return NextResponse.json({ error: "invalid_fy" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: rows, error } = await supabase
    .from("withholding_deductions")
    .select("deducted_on, gross_usd, tax_usd, sbi_tt_rate, gross_inr, tax_inr, tax_withholdings(withholding_agent_name, income_code, dtaa_article, ch3_tax_rate_pct, us_tax_year)")
    .eq("financial_year", fy)
    .order("deducted_on");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "Country",
    "Withholding agent",
    "US tax year",
    "Income code",
    "Deducted on",
    "Income (USD)",
    "Tax paid outside India (USD)",
    "SBI TT buying rate",
    "Income (INR)",
    "Tax paid outside India (INR)",
    "Indian tax on this income (INR)",
    "Credit claimed (INR)",
    "DTAA article",
    "US withholding rate (%)",
  ];
  let totIncome = 0;
  let totTax = 0;
  let totIndian = 0;
  let totCredit = 0;
  const lines = (rows ?? []).map((r) => {
    const w = r.tax_withholdings as unknown as {
      withholding_agent_name: string | null;
      income_code: string | null;
      dtaa_article: string | null;
      ch3_tax_rate_pct: number | null;
      us_tax_year: number;
    } | null;
    const incomeInr = Number(r.gross_inr ?? 0);
    const taxInr = Number(r.tax_inr ?? 0);
    const indian = Math.round(incomeInr * rate) / 100;
    const credit = Math.min(taxInr, indian);
    totIncome += incomeInr;
    totTax += taxInr;
    totIndian += indian;
    totCredit += credit;
    return [
      "United States of America",
      w?.withholding_agent_name,
      w?.us_tax_year,
      w?.income_code,
      r.deducted_on,
      r.gross_usd,
      r.tax_usd,
      r.sbi_tt_rate,
      incomeInr.toFixed(2),
      taxInr.toFixed(2),
      indian.toFixed(2),
      credit.toFixed(2),
      w?.dtaa_article,
      w?.ch3_tax_rate_pct,
    ].map(esc).join(",");
  });
  lines.push(
    ["TOTAL", "", "", "", "", "", "", "", totIncome.toFixed(2), totTax.toFixed(2), totIndian.toFixed(2), totCredit.toFixed(2), "", ""].join(","),
  );

  const csv = [`# ${ftcFormForFy(fy)} working for FY ${fy} (Indian tax rate ${rate}%)`, header.join(","), ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ftc-${fy}.csv"`,
    },
  });
}
