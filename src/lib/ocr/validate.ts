import type { OcrExtraction } from "./schema";

/**
 * Deterministic post-checks on model output. The model transcribes; these
 * rules decide. Nothing here calls the network.
 */

export type Severity = "error" | "warning" | "info";

export interface ValidationIssue {
  code: string;
  severity: Severity;
  message: string;
  field?: string;
}

const CENT_TOLERANCE = 1; // USD: allow rounding drift of up to $1

const near = (a: number, b: number, tol = CENT_TOLERANCE) => Math.abs(a - b) <= tol;

export function validateExtraction(x: OcrExtraction, ctx: { servicesPerformedInUs?: boolean } = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (x.overall_confidence < 0.85) {
    issues.push({
      code: "LOW_CONFIDENCE",
      severity: "warning",
      message: `Model confidence ${x.overall_confidence.toFixed(2)} is below 0.85; route to human review.`,
    });
  }

  const f = x.form_1042s;
  if (x.detected_doc_type === "form_1042s" && !f) {
    issues.push({ code: "SECTION_MISSING", severity: "error", message: "Detected a 1042-S but no 1042-S fields were extracted." });
  }

  if (f) {
    const gross = f.box2_gross_income;
    const withheld = f.box7a_federal_tax_withheld;
    const rate = f.box3b_ch3_tax_rate;

    if (gross == null || withheld == null) {
      issues.push({ code: "CORE_AMOUNT_MISSING", severity: "error", message: "Box 2 and Box 7a are required to compute a foreign tax credit." });
    }

    if (gross != null && withheld != null && rate != null && f.box3_chapter_indicator !== 4) {
      const expected = Math.round(gross * rate) / 100;
      if (!near(expected, withheld)) {
        issues.push({
          code: "RATE_MISMATCH",
          severity: "warning",
          field: "form_1042s.box7a_federal_tax_withheld",
          message: `Box 2 × Box 3b = ${expected.toFixed(2)} but Box 7a shows ${withheld.toFixed(2)}. Check for partial-year treaty claims or misread digits.`,
        });
      }
    }

    if (f.box10_total_withholding_credit != null && withheld != null) {
      const sum = withheld + (f.box8_tax_withheld_by_other_agents ?? 0);
      if (!near(sum, f.box10_total_withholding_credit)) {
        issues.push({
          code: "BOX10_MISMATCH",
          severity: "warning",
          field: "form_1042s.box10_total_withholding_credit",
          message: `Box 7a + Box 8 = ${sum.toFixed(2)} but Box 10 shows ${f.box10_total_withholding_credit.toFixed(2)}.`,
        });
      }
    }

    if (f.box13b_recipient_country_code && f.box13b_recipient_country_code.toUpperCase() !== "IN") {
      issues.push({
        code: "RECIPIENT_NOT_INDIA",
        severity: "warning",
        field: "form_1042s.box13b_recipient_country_code",
        message: `Recipient country code is '${f.box13b_recipient_country_code}', not 'IN'. US–India DTAA benefits may not have been applied.`,
      });
    }

    if (withheld != null && withheld > 0 && rate != null && rate >= 30 && f.box3a_ch3_exemption_code === "00") {
      issues.push({
        code: "STATUTORY_30_PERCENT",
        severity: "warning",
        message: "Withheld at the 30% statutory rate with no treaty exemption. A valid W-8BEN (or W-8BEN-E) claiming US–India DTAA benefits may have been missing; the excess over the treaty rate is refundable via Form 1040-NR, not creditable in India.",
      });
    }

    // Income code 17 = independent personal services. Services performed wholly
    // outside the US are foreign-source (IRC 862(a)(3)) and should not be subject
    // to US withholding at all — and India allows FTC only for tax paid in
    // accordance with the DTAA, so a credit for wrongly withheld tax is at risk.
    if (f.box1_income_code === "17" && withheld != null && withheld > 0 && ctx.servicesPerformedInUs === false) {
      issues.push({
        code: "WITHHOLDING_ON_FOREIGN_SOURCE_SERVICES",
        severity: "error",
        message: "US tax was withheld on services performed entirely outside the US. That income is foreign-source; seek a refund from the withholding agent or via Form 1040-NR before relying on an Indian FTC claim.",
      });
    }
  }

  if (x.form_1099) {
    issues.push({
      code: "FORM_1099_ISSUED_TO_FOREIGN_PERSON",
      severity: "warning",
      message: "A Form 1099 indicates the client treats you as a US person. Send the client a signed W-8BEN (individual) or W-8BEN-E (entity) and ask them to correct their records.",
    });
    if ((x.form_1099.federal_income_tax_withheld ?? 0) > 0) {
      issues.push({
        code: "BACKUP_WITHHOLDING",
        severity: "error",
        message: "Federal tax (likely 24% backup withholding) was withheld on a 1099. This is usually refundable rather than creditable; review before claiming FTC.",
      });
    }
  }

  const r = x.remittance;
  if (r && r.gross_amount != null && r.net_amount_paid != null) {
    const deductions = (r.tax_withheld_amount ?? 0) + (r.fees_deducted_amount ?? 0);
    if (!near(r.gross_amount - deductions, r.net_amount_paid)) {
      issues.push({
        code: "REMITTANCE_ARITHMETIC",
        severity: "warning",
        field: "remittance.net_amount_paid",
        message: `Gross ${r.gross_amount.toFixed(2)} − tax ${(r.tax_withheld_amount ?? 0).toFixed(2)} − fees ${(r.fees_deducted_amount ?? 0).toFixed(2)} ≠ net ${r.net_amount_paid.toFixed(2)}.`,
      });
    }
  }

  for (const c of x.concerns) {
    issues.push({ code: `MODEL_${c.issue.toUpperCase()}`, severity: "info", field: c.field, message: c.note });
  }

  return issues;
}

/** Indian financial year label for an ISO date: '2026-05-10' -> '2026-27'. Mirrors public.indian_fy(). */
export function indianFy(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
