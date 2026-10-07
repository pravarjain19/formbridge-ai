import type { Metadata } from "next";
import { DtaaCalculator } from "./dtaa-calculator";

export const metadata: Metadata = {
  title: "US–India DTAA withholding calculator | FormBridge.ai",
  description:
    "Should your US client withhold tax? Check the US–India treaty rate, which W-8 form to send, and the foreign tax credit you can claim in India (Form 67 / Form 44).",
};

export default function CalculatorPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">US–India DTAA withholding calculator</h1>
      <p className="mt-2 text-slate-600">
        For Indian freelancers, contractors and agencies paid by US clients. Find out whether any US tax should be
        withheld, which form to give your client, and what credit you can claim in India.
      </p>
      <DtaaCalculator />
      <p className="mt-10 text-xs text-slate-500">
        Estimate for planning only, not tax advice. Based on the India–US DTAA (Art. 7, 12, 15) and Indian FTC rules
        (Rule 128 / Rule 76). Confirm with a CA or US tax professional before filing.
      </p>
    </main>
  );
}
