import assert from "node:assert/strict";
import { test } from "node:test";
import { summariseFtc } from "./ftc";

test("splits a calendar-year slip across Indian FYs and caps the credit", () => {
  const rows = [
    // Jan–Mar 2026 deductions -> FY 2025-26 (Form 67)
    { financial_year: "2025-26", gross_usd: 6000, tax_usd: 1800, sbi_tt_rate: 86 },
    // Apr–Dec 2026 deductions -> FY 2026-27 (Form 44)
    { financial_year: "2026-27", gross_usd: 18000, tax_usd: 5400, sbi_tt_rate: 85 },
    { financial_year: "2026-27", gross_usd: 1000, tax_usd: 300, sbi_tt_rate: null },
  ];
  const s = summariseFtc(rows, (fy) => (fy === "2026-27" ? 20 : 31.2));
  assert.equal(s.length, 2);
  const [fy27, fy26] = s;

  assert.equal(fy27.form, "Form 44");
  assert.equal(fy27.missingRates, 1);
  assert.equal(fy27.incomeInr, 1530000); // 18000*85, unpriced row excluded
  assert.equal(fy27.foreignTaxInr, 459000);
  assert.equal(fy27.indianTaxInr, 306000);
  assert.equal(fy27.ftcInr, 306000); // capped at Indian tax

  assert.equal(fy26.form, "Form 67");
  assert.equal(fy26.foreignTaxInr, 154800);
  assert.equal(fy26.indianTaxInr, 160992);
  assert.equal(fy26.ftcInr, 154800); // full foreign tax
});
