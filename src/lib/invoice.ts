/**
 * Export-of-services invoice rules (GST Rule 46 + IGST Act s.16 zero-rating)
 * kept free of I/O so they can be unit-tested.
 */

export type ExportMode = "lut_without_igst" | "igst_paid_refund" | "not_registered";

export interface LineItemInput {
  description: string;
  sac_code?: string | null;
  quantity: number;
  unit_price_fcy: number;
}

export const LUT_DECLARATION =
  "SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX";
export const IGST_DECLARATION = "SUPPLY MEANT FOR EXPORT ON PAYMENT OF INTEGRATED TAX";

export const IGST_RATE_PCT = 18;
export const MAX_INVOICE_NUMBER_LENGTH = 16;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function lineAmount(i: LineItemInput) {
  return round2(i.quantity * i.unit_price_fcy);
}

export function invoiceTotals(items: LineItemInput[], fxRateInr: number, mode: ExportMode) {
  const subtotalFcy = round2(items.reduce((s, i) => s + lineAmount(i), 0));
  const subtotalInr = round2(subtotalFcy * fxRateInr);
  const igstRatePct = mode === "igst_paid_refund" ? IGST_RATE_PCT : 0;
  const igstAmountInr = round2((subtotalInr * igstRatePct) / 100);
  return { subtotalFcy, subtotalInr, igstRatePct, igstAmountInr };
}

export function gstDeclaration(mode: ExportMode): string | null {
  if (mode === "lut_without_igst") return LUT_DECLARATION;
  if (mode === "igst_paid_refund") return IGST_DECLARATION;
  return null;
}

/**
 * Next sequential number for a financial year, e.g. 'FB/26-27/007'.
 * Rule 46 caps the serial at 16 characters and requires uniqueness per FY.
 */
export function nextInvoiceNumber(existing: string[], fy: string, prefix = "FB"): string {
  const short = `${fy.slice(2, 4)}-${fy.slice(5, 7)}`; // '2026-27' -> '26-27'
  const head = `${prefix}/${short}/`;
  const max = existing
    .filter((n) => n.startsWith(head))
    .map((n) => Number(n.slice(head.length)))
    .filter(Number.isFinite)
    .reduce((m, n) => Math.max(m, n), 0);
  return `${head}${String(max + 1).padStart(3, "0")}`;
}

export function validateInvoiceNumber(n: string): string | null {
  if (!n) return "Invoice number is required";
  if (n.length > MAX_INVOICE_NUMBER_LENGTH) return `Invoice number must be at most ${MAX_INVOICE_NUMBER_LENGTH} characters (GST Rule 46)`;
  if (!/^[A-Za-z0-9/-]+$/.test(n)) return "Invoice number may only contain letters, digits, '/' and '-' (GST Rule 46)";
  return null;
}
