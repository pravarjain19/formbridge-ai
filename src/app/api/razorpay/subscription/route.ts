import { NextResponse } from "next/server";
import { razorpayPlanId, type Plan } from "@/lib/plans";
import { createSubscription, razorpayConfigured } from "@/lib/razorpay";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** POST { plan: "pro" | "agency" } -> { subscriptionId, keyId } for Razorpay Checkout. */
export async function POST(req: Request) {
  if (!razorpayConfigured()) return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: Plan };
  const planId = plan ? razorpayPlanId(plan) : undefined;
  if (!planId) return NextResponse.json({ error: "unknown_plan" }, { status: 400 });

  try {
    const sub = await createSubscription(planId, auth.user.id, auth.user.email ?? undefined);
    return NextResponse.json({ subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("razorpay subscription create failed", err);
    return NextResponse.json({ error: "razorpay_error" }, { status: 502 });
  }
}
