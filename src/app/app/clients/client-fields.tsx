import { Field, inputCls } from "../ui";

export interface ClientRow {
  id: string;
  legal_name: string;
  country_code: string;
  us_ein: string | null;
  billing_email: string | null;
  ap_contact_name: string | null;
  vendor_id: string | null;
  payment_terms_days: number;
  po_required: boolean;
  services_performed_in_us: boolean;
  address: { line?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null;
}

/** Shared inputs for the add and edit client forms. */
export function ClientFields({ c }: { c?: ClientRow }) {
  const a = c?.address ?? {};
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Client legal name">
        <input name="legal_name" required defaultValue={c?.legal_name} className={inputCls} />
      </Field>
      <Field label="Country (2-letter code)">
        <input name="country_code" defaultValue={c?.country_code ?? "US"} maxLength={2} className={`${inputCls} uppercase`} />
      </Field>
      <Field label="US EIN (optional)">
        <input name="us_ein" defaultValue={c?.us_ein ?? ""} placeholder="12-3456789" className={inputCls} />
      </Field>
      <Field label="Accounts payable email">
        <input name="billing_email" type="email" defaultValue={c?.billing_email ?? ""} className={inputCls} />
      </Field>
      <Field label="AP contact name">
        <input name="ap_contact_name" defaultValue={c?.ap_contact_name ?? ""} className={inputCls} />
      </Field>
      <Field label="Your vendor ID with this client" hint="Many US AP teams reject invoices without it.">
        <input name="vendor_id" defaultValue={c?.vendor_id ?? ""} className={inputCls} />
      </Field>
      <Field label="Street address">
        <input name="address_line" defaultValue={a.line ?? ""} className={inputCls} />
      </Field>
      <Field label="City">
        <input name="city" defaultValue={a.city ?? ""} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="State">
          <input name="state" defaultValue={a.state ?? ""} className={inputCls} />
        </Field>
        <Field label="ZIP">
          <input name="zip" defaultValue={a.zip ?? ""} className={inputCls} />
        </Field>
      </div>
      <Field label="Payment terms (days)">
        <input name="payment_terms_days" type="number" min={0} max={180} defaultValue={c?.payment_terms_days ?? 30} className={inputCls} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="po_required" defaultChecked={c?.po_required} /> Client requires a PO number on invoices
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="services_performed_in_us" defaultChecked={c?.services_performed_in_us} /> Some work for this
        client is done while I am in the US
      </label>
    </div>
  );
}
