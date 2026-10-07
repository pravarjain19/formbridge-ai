export type Plan = "free" | "pro" | "agency";

export const PLANS: Record<Plan, { name: string; priceInr: number; ocrPerMonth: number; blurb: string }> = {
  free: { name: "Free", priceInr: 0, ocrPerMonth: 5, blurb: "Calculator, invoices, 5 document checks a month" },
  pro: { name: "Pro", priceInr: 499, ocrPerMonth: 100, blurb: "For freelancers: 100 document checks, FTC reports" },
  agency: { name: "Agency", priceInr: 1999, ocrPerMonth: 1000, blurb: "For agencies and CAs: 1,000 document checks" },
};

/** Razorpay plan ids are created in the Razorpay dashboard and configured per environment. */
export function razorpayPlanId(plan: Plan): string | undefined {
  if (plan === "pro") return process.env.RAZORPAY_PLAN_PRO;
  if (plan === "agency") return process.env.RAZORPAY_PLAN_AGENCY;
  return undefined;
}

export function planForRazorpayPlanId(planId: string | null | undefined): Plan | null {
  if (!planId) return null;
  if (planId === process.env.RAZORPAY_PLAN_PRO) return "pro";
  if (planId === process.env.RAZORPAY_PLAN_AGENCY) return "agency";
  return null;
}
