import * as z from "zod/v4";

/**
 * Strict extraction contract for US tax slips and client remittance advice.
 *
 * Every field is required-but-nullable: the model must emit every key and use
 * null when a value is absent or illegible, never guess. Monetary values are
 * plain numbers in the document's currency (no symbols, no thousands
 * separators). Dates are ISO-8601 (YYYY-MM-DD).
 *
 * Bump OCR_SCHEMA_VERSION whenever this shape changes; it is stored on every
 * ocr_runs row so old extractions stay interpretable.
 */
export const OCR_SCHEMA_VERSION = "2026-10-07.1";

const money = z.number().nullable();
const text = z.string().nullable();
const isoDate = z.string().nullable().describe("ISO-8601 date YYYY-MM-DD, or null");

export const DetectedDocType = z.enum([
  "form_1042s",
  "form_1099_nec",
  "form_1099_misc",
  "remittance_advice",
  "firc",
  "other",
]);

/** IRS Form 1042-S, box numbering per the current IRS layout. */
const Form1042S = z.object({
  tax_year: z.number().int().nullable(),
  unique_form_identifier: text.describe("UFI printed at top of the form"),
  is_amended: z.boolean().nullable(),
  amendment_number: z.number().int().nullable(),
  box1_income_code: text.describe("Two-digit income code, e.g. '17' independent personal services"),
  box2_gross_income: money,
  box3_chapter_indicator: z.number().int().nullable().describe("3 or 4"),
  box3a_ch3_exemption_code: text,
  box3b_ch3_tax_rate: z.number().nullable().describe("Percent, e.g. 30.00 or 15.00"),
  box4a_ch4_exemption_code: text,
  box4b_ch4_tax_rate: z.number().nullable(),
  box5_withholding_allowance: money,
  box6_net_income: money,
  box7a_federal_tax_withheld: money,
  box7b_withheld_by_other_agents_checked: z.boolean().nullable(),
  box8_tax_withheld_by_other_agents: money,
  box9_overwithheld_tax_repaid: money,
  box10_total_withholding_credit: money,
  box11_tax_paid_by_withholding_agent: money,
  box12a_withholding_agent_ein: text,
  box12b_ch3_status_code: text,
  box12c_ch4_status_code: text,
  box12d_withholding_agent_name: text,
  box12_withholding_agent_country: text,
  box13a_recipient_name: text,
  box13b_recipient_country_code: text.describe("IRS country code; India is 'IN'"),
  box13e_recipient_us_tin: text,
  box13f_ch3_status_code: text,
  box13g_ch4_status_code: text,
  box13i_recipient_foreign_tin: text,
  box13j_lob_code: text,
  box13k_recipient_account_number: text,
  box13l_recipient_date_of_birth: isoDate,
  box14a_primary_withholding_agent_name: text,
  box16a_payer_name: text,
});

/** Form 1099-NEC / 1099-MISC — should NOT normally exist for a foreign person. */
const Form1099 = z.object({
  tax_year: z.number().int().nullable(),
  payer_name: text,
  payer_tin: text,
  recipient_name: text,
  recipient_tin: text,
  nonemployee_compensation: money,
  federal_income_tax_withheld: money,
});

/** Client remittance advice / payment confirmation / FIRC. */
const Remittance = z.object({
  payer_name: text,
  payer_reference: text.describe("Payment / wire / ACH reference"),
  payment_date: isoDate,
  currency: text.describe("ISO-4217, e.g. USD"),
  gross_amount: money,
  tax_withheld_amount: money,
  fees_deducted_amount: money,
  net_amount_paid: money,
  invoice_numbers_referenced: z.array(z.string()),
  // FIRC / bank-credit fields when present
  inr_amount_credited: money,
  exchange_rate_applied: z.number().nullable(),
  purpose_code: text.describe("RBI purpose code, e.g. P0802"),
  bank_name: text,
  firc_or_advice_number: text,
});

export const FieldConcern = z.object({
  field: z.string().describe("Dotted path, e.g. form_1042s.box7a_federal_tax_withheld"),
  issue: z.enum(["illegible", "ambiguous", "inconsistent", "missing_expected"]),
  note: z.string(),
});

export const OcrExtraction = z.object({
  detected_doc_type: DetectedDocType,
  overall_confidence: z
    .number()
    .describe("0.0-1.0: your confidence that every non-null value is transcribed exactly"),
  form_1042s: Form1042S.nullable(),
  form_1099: Form1099.nullable(),
  remittance: Remittance.nullable(),
  concerns: z.array(FieldConcern),
});

export type OcrExtraction = z.infer<typeof OcrExtraction>;
export type DetectedDocType = z.infer<typeof DetectedDocType>;
