import { createHmac } from "node:crypto";

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const normalisePan = (pan: string) => pan.replace(/\s/g, "").toUpperCase();
export const isValidPan = (pan: string) => PAN_RE.test(normalisePan(pan));

/** ABCDE1234F -> ABCDE****F (matches the profiles.pan_masked check constraint). */
export function maskPan(pan: string): string {
  const p = normalisePan(pan);
  return `${p.slice(0, 5)}****${p.slice(9)}`;
}

/**
 * Keyed hash so a PAN can be matched (e.g. against a 1042-S Box 13i) without
 * storing it. Set PAN_HASH_SECRET in production; the fallback only keeps dev working.
 */
export function hashPan(pan: string): string {
  const secret = process.env.PAN_HASH_SECRET || "formbridge-dev-only-secret";
  return createHmac("sha256", secret).update(normalisePan(pan)).digest("hex");
}
