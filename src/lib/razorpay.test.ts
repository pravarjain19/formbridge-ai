import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { verifySubscriptionPayment, verifyWebhook } from "./razorpay";

test("checkout signature: payment_id|subscription_id", () => {
  const secret = "test_secret";
  const signature = createHmac("sha256", secret).update("pay_123|sub_456").digest("hex");
  assert.equal(verifySubscriptionPayment({ paymentId: "pay_123", subscriptionId: "sub_456", signature }, secret), true);
  assert.equal(verifySubscriptionPayment({ paymentId: "pay_123", subscriptionId: "sub_999", signature }, secret), false);
  assert.equal(verifySubscriptionPayment({ paymentId: "pay_123", subscriptionId: "sub_456", signature }, ""), false);
});

test("webhook signature over the raw body", () => {
  const body = JSON.stringify({ event: "subscription.activated" });
  const sig = createHmac("sha256", "whsec").update(body).digest("hex");
  assert.equal(verifyWebhook(body, sig, "whsec"), true);
  assert.equal(verifyWebhook(body + " ", sig, "whsec"), false);
  assert.equal(verifyWebhook(body, null, "whsec"), false);
});
