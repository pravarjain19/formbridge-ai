"use client";

import { useMemo, useState } from "react";
import { estimateDtaa, type DtaaInput } from "@/lib/tax/dtaa";

const NOTE_STYLE = {
  ok: "border-green-300 bg-green-50 text-green-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  review: "border-red-300 bg-red-50 text-red-900",
} as const;

const usd = (n: number) => `USD ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function DtaaCalculator() {
  const [input, setInput] = useState<DtaaInput>({
    payeeType: "individual",
    incomeType: "services",
    amountUsd: 60000,
    usWorkSharePct: 0,
    daysInUs: 0,
    usFixedBaseOrPe: false,
    w8OnFile: true,
    indianTaxRatePct: 31.2,
    sbiTtRate: 85,
  });
  const result = useMemo(() => estimateDtaa(input), [input]);
  const set = <K extends keyof DtaaInput>(k: K, v: DtaaInput[K]) => setInput((p) => ({ ...p, [k]: v }));
  const num = (k: keyof DtaaInput) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={(e) => e.preventDefault()}>
        <Field label="You are">
          <select className={inputCls} value={input.payeeType} onChange={(e) => set("payeeType", e.target.value as DtaaInput["payeeType"])}>
            <option value="individual">An individual / sole proprietor</option>
            <option value="entity">A company / LLP / agency</option>
          </select>
        </Field>
        <Field label="What are you paid for?">
          <select className={inputCls} value={input.incomeType} onChange={(e) => set("incomeType", e.target.value as DtaaInput["incomeType"])}>
            <option value="services">Services (development, design, consulting…)</option>
            <option value="fis">Technical services that transfer know-how</option>
            <option value="royalty">Royalties / licence fees</option>
          </select>
        </Field>
        <Field label="Annual amount from this client (USD)">
          <input type="number" min={0} className={inputCls} value={input.amountUsd} onChange={num("amountUsd")} />
        </Field>
        {input.incomeType === "services" && (
          <>
            <Field label="Share of the work done while physically in the US (%)">
              <input type="number" min={0} max={100} className={inputCls} value={input.usWorkSharePct} onChange={num("usWorkSharePct")} />
            </Field>
            <Field label="Days in the US this year">
              <input type="number" min={0} max={366} className={inputCls} value={input.daysInUs} onChange={num("daysInUs")} />
            </Field>
            <Check
              label={input.payeeType === "individual" ? "I have a fixed office in the US" : "We have a US branch / office (PE)"}
              checked={input.usFixedBaseOrPe}
              onChange={(v) => set("usFixedBaseOrPe", v)}
            />
          </>
        )}
        <Check label="I have given the client a signed W-8BEN / W-8BEN-E" checked={input.w8OnFile} onChange={(v) => set("w8OnFile", v)} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Your Indian tax rate (%)">
            <input type="number" min={0} max={50} step={0.1} className={inputCls} value={input.indianTaxRatePct} onChange={num("indianTaxRatePct")} />
          </Field>
          <Field label="SBI TT buying rate (₹/USD)">
            <input type="number" min={0} step={0.01} className={inputCls} value={input.sbiTtRate} onChange={num("sbiTtRate")} />
          </Field>
        </div>
      </form>

      <section className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Correct US withholding</p>
          <p className="text-3xl font-bold">
            {result.correctUsRatePct}% · {usd(result.correctUsTaxUsd)}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Give the client</dt>
            <dd className="font-medium">{result.formToGiveClient}</dd>
            <dt className="text-slate-500">Treaty article</dt>
            <dd className="font-medium">{result.treatyArticle}</dd>
            <dt className="text-slate-500">US-source / foreign-source</dt>
            <dd className="font-medium">
              {usd(result.usSourceUsd)} / {usd(result.foreignSourceUsd)}
            </dd>
            <dt className="text-slate-500">Expected US reporting</dt>
            <dd className="font-medium">{result.expectedUsReporting}</dd>
            <dt className="text-slate-500">Indian FTC (est.)</dt>
            <dd className="font-medium">{inr(result.ftcInr)}</dd>
            {result.riskUsTaxUsd > result.correctUsTaxUsd && (
              <>
                <dt className="text-slate-500">At risk without paperwork</dt>
                <dd className="font-medium text-red-700">{usd(result.riskUsTaxUsd)}</dd>
              </>
            )}
          </dl>
        </div>
        {result.notes.map((n, i) => (
          <p key={i} className={`rounded-md border p-3 text-sm ${NOTE_STYLE[n.severity]}`}>
            {n.text}
          </p>
        ))}
      </section>
    </div>
  );
}

const inputCls = "mt-1 block w-full rounded-md border border-slate-300 px-2 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
