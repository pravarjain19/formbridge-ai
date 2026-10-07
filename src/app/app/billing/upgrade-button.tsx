"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Plan } from "@/lib/plans";
import { buttonCls } from "../ui";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay Checkout"));
    document.body.appendChild(s);
  });
}

export function UpgradeButton({ plan, enabled, email }: { plan: Plan; enabled: boolean; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/razorpay/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start checkout");
      await loadCheckout();
      const checkout = new window.Razorpay!({
        key: body.keyId,
        subscription_id: body.subscriptionId,
        name: "FormBridge.ai",
        description: `${plan === "pro" ? "Pro" : "Agency"} plan`,
        prefill: { email },
        handler: async (r: Record<string, string>) => {
          const v = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(r),
          });
          if (!v.ok) setError("Payment received but verification failed; it will update within a few minutes.");
          router.refresh();
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={upgrade} disabled={!enabled || busy} className={buttonCls}>
        {busy ? "Opening checkout…" : "Upgrade"}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </>
  );
}
