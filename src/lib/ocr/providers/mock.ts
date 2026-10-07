import type { OcrExtraction } from "../schema";
import type { ExtractInput, OcrProvider } from "./types";

/**
 * Offline provider for development: returns a canned extraction so the whole
 * pipeline (validation, DB writes, UI) can be exercised with no API key.
 * Upload anything; a docTypeHint or filename containing "remit" returns the
 * remittance sample, otherwise the 1042-S sample.
 *
 * The 1042-S sample is deliberately wrong (30% statutory withholding on
 * income code 17) so the validation warnings show up in the UI.
 */
const SAMPLE_1042S: OcrExtraction = {
  detected_doc_type: "form_1042s",
  overall_confidence: 0.93,
  form_1042s: {
    tax_year: 2025,
    unique_form_identifier: "2500012345",
    is_amended: false,
    amendment_number: null,
    box1_income_code: "17",
    box2_gross_income: 24000,
    box3_chapter_indicator: 3,
    box3a_ch3_exemption_code: "00",
    box3b_ch3_tax_rate: 30,
    box4a_ch4_exemption_code: "15",
    box4b_ch4_tax_rate: 0,
    box5_withholding_allowance: null,
    box6_net_income: null,
    box7a_federal_tax_withheld: 7200,
    box7b_withheld_by_other_agents_checked: false,
    box8_tax_withheld_by_other_agents: null,
    box9_overwithheld_tax_repaid: null,
    box10_total_withholding_credit: 7200,
    box11_tax_paid_by_withholding_agent: null,
    box12a_withholding_agent_ein: "12-3456789",
    box12b_ch3_status_code: "15",
    box12c_ch4_status_code: "21",
    box12d_withholding_agent_name: "Acme Robotics Inc.",
    box12_withholding_agent_country: "US",
    box13a_recipient_name: "Sample Contractor",
    box13b_recipient_country_code: "IN",
    box13e_recipient_us_tin: null,
    box13f_ch3_status_code: "16",
    box13g_ch4_status_code: "23",
    box13i_recipient_foreign_tin: "ABCDE1234F",
    box13j_lob_code: null,
    box13k_recipient_account_number: null,
    box13l_recipient_date_of_birth: null,
    box14a_primary_withholding_agent_name: null,
    box16a_payer_name: null,
  },
  form_1099: null,
  remittance: null,
  concerns: [],
};

const SAMPLE_REMITTANCE: OcrExtraction = {
  detected_doc_type: "remittance_advice",
  overall_confidence: 0.96,
  form_1042s: null,
  form_1099: null,
  remittance: {
    payer_name: "Acme Robotics Inc.",
    payer_reference: "WIRE-2026-0412-7781",
    payment_date: "2026-04-12",
    currency: "USD",
    gross_amount: 4000,
    tax_withheld_amount: 0,
    fees_deducted_amount: 25,
    net_amount_paid: 3975,
    invoice_numbers_referenced: ["FB/26-27/001"],
    inr_amount_credited: null,
    exchange_rate_applied: null,
    purpose_code: "P0802",
    bank_name: null,
    firc_or_advice_number: null,
  },
  concerns: [],
};

export const mockProvider: OcrProvider = {
  name: "mock",
  model: "mock",
  async extract({ docTypeHint }: ExtractInput) {
    const remit = /remit/i.test(docTypeHint ?? "");
    return {
      extraction: structuredClone(remit ? SAMPLE_REMITTANCE : SAMPLE_1042S),
      stopReason: "end_turn",
      refusalCategory: null,
      servedByModel: "mock",
      inputTokens: 0,
      outputTokens: 0,
    };
  },
};
