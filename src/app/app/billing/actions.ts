"use server";

import { redirect } from "next/navigation";
import { cancelSubscription } from "@/lib/razorpay";
import { requireUser } from "@/lib/supabase/server";

export async function cancelPlan() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("razorpay_subscription_id").eq("id", user.id).single();
  if (!profile?.razorpay_subscription_id) redirect("/app/billing?error=No%20active%20subscription");
  try {
    // Access continues to the end of the paid period; the webhook downgrades the plan when it ends.
    await cancelSubscription(profile!.razorpay_subscription_id);
  } catch (err) {
    redirect(`/app/billing?error=${encodeURIComponent(err instanceof Error ? err.message : "Cancel failed")}`);
  }
  redirect("/app/billing?ok=Subscription%20will%20end%20at%20the%20end%20of%20this%20billing%20period");
}
