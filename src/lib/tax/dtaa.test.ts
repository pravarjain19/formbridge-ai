import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateDtaa, type DtaaInput } from "./dtaa";

const base: DtaaInput = {
  payeeType: "individual",
  incomeType: "services",
  amountUsd: 60000,
  usWorkSharePct: 0,
  daysInUs: 0,
  usFixedBaseOrPe: false,
  w8OnFile: true,
  indianTaxRatePct: 31.2,
  sbiTtRate: 85,
};

test("remote services from India: no US tax, W-8BEN, no reporting", () => {
  const r = estimateDtaa(base);
  assert.equal(r.usSourceUsd, 0);
  assert.equal(r.correctUsTaxUsd, 0);
  assert.equal(r.formToGiveClient, "W-8BEN");
  assert.equal(r.ftcInr, 0);
  assert.match(r.expectedUsReporting, /None/);
});

test("missing W-8BEN shows 30% exposure on the full amount", () => {
  const r = estimateDtaa({ ...base, w8OnFile: false });
  assert.equal(r.correctUsTaxUsd, 0);
  assert.equal(r.riskUsTaxUsd, 18000);
});

test("short US visit is treaty-exempt but needs Form 8233", () => {
  const r = estimateDtaa({ ...base, usWorkSharePct: 10, daysInUs: 20 });
  assert.equal(r.usSourceUsd, 6000);
  assert.equal(r.correctUsTaxUsd, 0);
  assert.equal(r.formToGiveClient, "Form 8233 + W-8BEN");
});

test("90+ days in the US makes US-performed work taxable at 30%", () => {
  const r = estimateDtaa({ ...base, usWorkSharePct: 50, daysInUs: 120 });
  assert.equal(r.usSourceUsd, 30000);
  assert.equal(r.correctUsTaxUsd, 9000);
  // FTC capped at Indian tax on that income: 30000*85*31.2% = 795600 < 9000*85 = 765000 -> 765000
  assert.equal(r.ftcInr, 765000);
  assert.ok(r.notes.some((n) => n.severity === "review"));
});

test("royalty: 15% treaty rate, FTC capped by Indian tax", () => {
  const r = estimateDtaa({ ...base, incomeType: "royalty", amountUsd: 10000, indianTaxRatePct: 10 });
  assert.equal(r.correctUsTaxUsd, 1500);
  assert.equal(r.indianTaxOnUsIncomeInr, 85000);
  assert.equal(r.ftcInr, 85000); // 1500*85 = 127500 capped at 85000
});

test("entity with no PE: business profits exempt, W-8BEN-E", () => {
  const r = estimateDtaa({ ...base, payeeType: "entity", usWorkSharePct: 20, daysInUs: 200 });
  assert.equal(r.correctUsTaxUsd, 0);
  assert.equal(r.formToGiveClient, "W-8BEN-E");
});

test("bad inputs are clamped, never NaN", () => {
  const r = estimateDtaa({ ...base, amountUsd: -5, usWorkSharePct: 500, sbiTtRate: Number.NaN });
  assert.equal(r.usSourceUsd, 0);
  assert.ok(Number.isFinite(r.ftcInr));
});
