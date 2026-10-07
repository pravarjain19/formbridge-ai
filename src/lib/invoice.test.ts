import assert from "node:assert/strict";
import { test } from "node:test";
import { gstDeclaration, invoiceTotals, LUT_DECLARATION, nextInvoiceNumber, validateInvoiceNumber } from "./invoice";
import { ftcFormForFy, indianFy, ttRateDateFor } from "./tax/dates";

test("totals: LUT export has zero IGST", () => {
  const t = invoiceTotals(
    [
      { description: "Dev", quantity: 80, unit_price_fcy: 45.5 },
      { description: "Hosting", quantity: 1, unit_price_fcy: 120 },
    ],
    84.25,
    "lut_without_igst",
  );
  assert.equal(t.subtotalFcy, 3760);
  assert.equal(t.subtotalInr, 316780);
  assert.equal(t.igstAmountInr, 0);
});

test("totals: IGST-paid export charges 18%", () => {
  const t = invoiceTotals([{ description: "x", quantity: 1, unit_price_fcy: 1000 }], 85, "igst_paid_refund");
  assert.equal(t.igstAmountInr, 15300);
});

test("declaration text", () => {
  assert.equal(gstDeclaration("lut_without_igst"), LUT_DECLARATION);
  assert.equal(gstDeclaration("not_registered"), null);
});

test("invoice numbering per FY, <= 16 chars", () => {
  assert.equal(nextInvoiceNumber([], "2026-27"), "FB/26-27/001");
  assert.equal(nextInvoiceNumber(["FB/26-27/001", "FB/26-27/009", "FB/25-26/050"], "2026-27"), "FB/26-27/010");
  assert.ok(nextInvoiceNumber([], "2026-27").length <= 16);
  assert.equal(validateInvoiceNumber("FB/26-27/001"), null);
  assert.ok(validateInvoiceNumber("THIS-IS-WAY-TOO-LONG-1"));
  assert.ok(validateInvoiceNumber("FB 001"));
});

test("dates: FY, FTC form, SBI TT rate date", () => {
  assert.equal(indianFy("2027-01-15"), "2026-27");
  assert.equal(ftcFormForFy("2025-26"), "Form 67");
  assert.equal(ftcFormForFy("2026-27"), "Form 44");
  assert.equal(ttRateDateFor("2026-03-15"), "2026-02-28");
  assert.equal(ttRateDateFor("2028-03-01"), "2028-02-29");
  assert.equal(ttRateDateFor("2026-01-10"), "2025-12-31");
});
