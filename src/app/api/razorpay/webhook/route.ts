import { NextResponse } from "next/server";
import { applySubscription } from "@/lib/billing";
import { verifyWebhook, type RazorpaySubscription } from "@/lib/razorpay";

/**
 * Razorpay webhook (Dashboard → Webhooks → URL /api/razorpay/webhook, secret =
 * RAZORPAY_WEBHOOK_SECRET). Subscribe to subscription.activated, .charged,
 * .pending, .halted, .cancelled, .completed.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  let event: { event?: string; payload?: { subscription?: { entity?: RazorpaySubscription } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const sub = event.payload?.subscription?.entity;
  if (event.event?.startsWith("subscription.") && sub) {
    const plan = await applySubscription(sub);
    return NextResponse.json({ ok: true, plan });
  }
  return NextResponse.json({ ok: true, ignored: event.event ?? null });
}
