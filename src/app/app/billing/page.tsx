import { PLANS, type Plan } from "@/lib/plans";
import { razorpayConfigured } from "@/lib/razorpay";
import { requireUser } from "@/lib/supabase/server";
import { Badge, Card, Flash, PageTitle } from "../ui";
import { cancelPlan } from "./actions";
import { UpgradeButton } from "./upgrade-button";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { supabase, user } = await requireUser();
  const { error, ok } = await searchParams;
  const [{ data: profile }, { count: used }] = await Promise.all([
    supabase.from("profiles").select("plan, plan_renews_at, razorpay_subscription_id").eq("id", user.id).single(),
    supabase
      .from("ocr_runs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);
  const current = (profile?.plan ?? "free") as Plan;

  return (
    <>
      <PageTitle title="Plan & billing" />
      <Flash error={error} ok={ok} />
      <p className="mb-4 text-sm text-slate-600">
        Document checks this month: <b>{used ?? 0}</b> of {PLANS[current].ocrPerMonth}.
        {profile?.plan_renews_at && ` Renews ${profile.plan_renews_at.slice(0, 10)}.`}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {(Object.keys(PLANS) as Plan[]).map((p) => (
          <Card key={p}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{PLANS[p].name}</h2>
              {p === current && <Badge tone="green">Current</Badge>}
            </div>
            <p className="mt-1 text-2xl font-bold">
              ₹{PLANS[p].priceInr.toLocaleString("en-IN")}
              <span className="text-sm font-normal text-slate-500">/month</span>
            </p>
            <p className="mt-2 text-sm text-slate-600">{PLANS[p].blurb}</p>
            <div className="mt-4">
              {p !== "free" && p !== current && (
                <UpgradeButton plan={p} enabled={razorpayConfigured()} email={user.email ?? ""} />
              )}
              {p === current && p !== "free" && profile?.razorpay_subscription_id && (
                <form action={cancelPlan}>
                  <button className="text-sm text-red-700 underline">Cancel at end of billing period</button>
                </form>
              )}
            </div>
          </Card>
        ))}
      </div>
      {!razorpayConfigured() && (
        <p className="mt-4 text-xs text-slate-500">
          Payments are not configured on this server (set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and the plan ids).
        </p>
      )}
    </>
  );
}
