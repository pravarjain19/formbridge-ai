import { NextResponse } from "next/server";
import { applySubscription } from "@/lib/billing";
import { fetchSubscription, verifySubscriptionPayment } from "@/lib/razorpay";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
 * Called by the Checkout success handler. Verifies the signature, re-reads the
 * subscription from Razorpay, and upgrades the plan. The webhook does the same
 * independently, so a closed tab doesn't lose the upgrade.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, string | undefined>;
  const paymentId = b.razorpay_payment_id;
  const subscriptionId = b.razorpay_subscription_id;
  const signature = b.razorpay_signature;
  if (!paymentId || !subscriptionId || !signature) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  if (!verifySubscriptionPayment({ paymentId, subscriptionId, signature })) {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const sub = await fetchSubscription(subscriptionId);
  if (sub.notes?.user_id !== auth.user.id) return NextResponse.json({ error: "not_your_subscription" }, { status: 403 });

  const plan = await applySubscription(sub);
  return NextResponse.json({ plan });
}
