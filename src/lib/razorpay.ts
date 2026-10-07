import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal Razorpay REST client (subscriptions only) plus signature checks.
 * Docs: https://razorpay.com/docs/api/payments/subscriptions/
 */

export const razorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Checkout handler signature: HMAC_SHA256(payment_id + "|" + subscription_id, key_secret). */
export function verifySubscriptionPayment(
  p: { paymentId: string; subscriptionId: string; signature: string },
  secret = process.env.RAZORPAY_KEY_SECRET ?? "",
) {
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${p.paymentId}|${p.subscriptionId}`).digest("hex");
  return safeEqualHex(expected, p.signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook secret) in X-Razorpay-Signature. */
export function verifyWebhook(rawBody: string, signature: string | null, secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "") {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  short_url?: string;
  current_end?: number | null;
  notes?: Record<string, string>;
}

async function rzp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json", ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay ${res.status}: ${body?.error?.description ?? "request failed"}`);
  return body as T;
}

export function createSubscription(planId: string, userId: string, email: string | undefined) {
  return rzp<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      total_count: 120, // monthly for up to 10 years; cancellable any time
      customer_notify: 1,
      notes: { user_id: userId, ...(email ? { email } : {}) },
    }),
  });
}

export function fetchSubscription(id: string) {
  return rzp<RazorpaySubscription>(`/subscriptions/${encodeURIComponent(id)}`);
}

export function cancelSubscription(id: string) {
  return rzp<RazorpaySubscription>(`/subscriptions/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancel_at_cycle_end: 1 }),
  });
}

export type { RazorpaySubscription };
