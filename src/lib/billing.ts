import "server-only";
import { planForRazorpayPlanId, type Plan } from "./plans";
import type { RazorpaySubscription } from "./razorpay";
import { createSupabaseAdminClient } from "./supabase/admin";

const ACTIVE = new Set(["active", "authenticated", "pending"]); // pending = retrying a failed charge; keep access meanwhile
const ENDED = new Set(["cancelled", "halted", "completed", "expired"]);

/**
 * Apply a Razorpay subscription's state to the owning profile. The owner comes
 * from the subscription's notes (set by our server when it was created), never
 * from the browser.
 */
export async function applySubscription(sub: RazorpaySubscription): Promise<Plan | null> {
  const userId = sub.notes?.user_id;
  if (!userId) return null;
  const paidPlan = planForRazorpayPlanId(sub.plan_id);
  if (!paidPlan) return null;

  const admin = createSupabaseAdminClient();
  if (ACTIVE.has(sub.status)) {
    await admin
      .from("profiles")
      .update({
        plan: paidPlan,
        razorpay_subscription_id: sub.id,
        plan_renews_at: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
      })
      .eq("id", userId);
    return paidPlan;
  }
  if (ENDED.has(sub.status)) {
    // Only downgrade if this is still the subscription on file (ignore stale events for old ones).
    const { data } = await admin
      .from("profiles")
      .update({ plan: "free", plan_renews_at: null })
      .eq("id", userId)
      .eq("razorpay_subscription_id", sub.id)
      .select("id");
    return data?.length ? "free" : null;
  }
  return null;
}
