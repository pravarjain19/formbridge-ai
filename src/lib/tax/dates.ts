/** Indian financial year label for an ISO date: '2026-05-10' -> '2026-27'. Mirrors public.indian_fy(). */
export function indianFy(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Whole days from today until an ISO date (negative if past). */
export function daysUntil(isoDate: string): number {
  const ms = new Date(`${isoDate}T00:00:00Z`).getTime() - new Date(`${todayIso()}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** FTC form for income of an Indian FY: Form 67 up to 2025-26, Form 44 from 2026-27. Mirrors public.ftc_form_for_fy(). */
export const ftcFormForFy = (fy: string) => (Number(fy.split("-")[0]) >= 2026 ? "Form 44" : "Form 67");

/**
 * Month whose last-day SBI TT buying rate applies to tax deducted on `isoDate`
 * (Rule 128 / Rule 76): the month immediately preceding the month of deduction.
 * Returns the ISO date of that last day.
 */
export function ttRateDateFor(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  // Day 0 of month m (1-based) in Date.UTC(y, m-1, 0) is the last day of the previous month.
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
}
