import { indianFy, todayIso } from "@/lib/tax/dates";
import { requireUser } from "@/lib/supabase/server";
import { buttonCls, Card, Field, Flash, inputCls, PageTitle } from "../ui";
import { addLut, saveProfile } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { supabase, user } = await requireUser();
  const { error, ok } = await searchParams;
  const [{ data: profile }, { data: luts }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("lut_registrations").select("financial_year, arn, filed_on").order("financial_year", { ascending: false }),
  ]);
  const addr = (profile?.address ?? {}) as Record<string, string | null>;
  const currentFy = indianFy(todayIso());

  return (
    <>
      <PageTitle title="Settings" />
      <Flash error={error} ok={ok} />

      <Card>
        <h2 className="mb-4 font-semibold">Business profile (shown on invoices)</h2>
        <form action={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal name">
            <input name="legal_name" required defaultValue={profile?.legal_name ?? ""} className={inputCls} />
          </Field>
          <Field label="Trade name (optional)">
            <input name="trade_name" defaultValue={profile?.trade_name ?? ""} className={inputCls} />
          </Field>
          <Field label="Entity type">
            <select name="entity_kind" defaultValue={profile?.entity_kind ?? "individual"} className={inputCls}>
              <option value="individual">Individual</option>
              <option value="proprietorship">Proprietorship</option>
              <option value="llp">LLP</option>
              <option value="private_limited">Private limited</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="GSTIN" hint="Leave blank if not GST-registered.">
            <input name="gstin" defaultValue={profile?.gstin ?? ""} className={`${inputCls} uppercase`} maxLength={15} />
          </Field>
          <Field label="PAN" hint={profile?.pan_masked ? `On file: ${profile.pan_masked}. Type a new one to replace it.` : "Stored masked; never shown in full."}>
            <input name="pan" className={`${inputCls} uppercase`} maxLength={10} autoComplete="off" />
          </Field>
          <Field label="Address">
            <input name="address_line" defaultValue={addr.line ?? ""} className={inputCls} />
          </Field>
          <Field label="City">
            <input name="city" defaultValue={addr.city ?? ""} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="State">
              <input name="state" defaultValue={addr.state ?? ""} className={inputCls} />
            </Field>
            <Field label="PIN code">
              <input name="pincode" defaultValue={addr.pincode ?? ""} className={inputCls} maxLength={6} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <button className={buttonCls}>Save profile</button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="font-semibold">GST Letter of Undertaking (RFD-11)</h2>
        <p className="mt-1 text-sm text-slate-600">
          An LUT lets you invoice exports without paying IGST. It is valid for one financial year; file a new one on the
          GST portal before your first export each April.
        </p>
        <ul className="mt-4 space-y-1 text-sm">
          {(luts ?? []).map((l) => (
            <li key={l.financial_year}>
              <b>FY {l.financial_year}</b> · ARN {l.arn} · filed {l.filed_on}
              {l.financial_year === currentFy && <span className="ml-2 text-green-700">(current)</span>}
            </li>
          ))}
          {!luts?.length && <li className="text-slate-500">No LUT recorded yet.</li>}
        </ul>
        <form action={addLut} className="mt-4 grid gap-4 sm:grid-cols-4">
          <Field label="Financial year">
            <input name="financial_year" required defaultValue={currentFy} className={inputCls} />
          </Field>
          <Field label="ARN">
            <input name="arn" required className={`${inputCls} uppercase`} />
          </Field>
          <Field label="Filed on">
            <input name="filed_on" type="date" required className={inputCls} />
          </Field>
          <div className="self-end">
            <button className={buttonCls}>Save LUT</button>
          </div>
        </form>
      </Card>
    </>
  );
}
