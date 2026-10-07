import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { buttonCls, Card, Field, Flash, inputCls, PageTitle } from "../../ui";
import { addW8, updateClient } from "../actions";
import { ClientFields, type ClientRow } from "../client-fields";
import { W8Status } from "../w8-status";

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { error, ok } = await searchParams;
  const { supabase } = await requireUser();
  const [{ data: client }, { data: w8s }, { data: profile }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("w8_certifications").select("id, form_type, signed_on, expires_on, treaty_article").eq("client_id", id).order("signed_on", { ascending: false }),
    supabase.from("profiles").select("entity_kind").single(),
  ]);
  if (!client) notFound();
  const defaultForm = profile?.entity_kind === "individual" || profile?.entity_kind === "proprietorship" ? "W-8BEN" : "W-8BEN-E";

  return (
    <>
      <PageTitle title={client.legal_name}>
        <W8Status latest={w8s?.[0] ?? null} />
      </PageTitle>
      <Flash error={error} ok={ok} />

      <Card>
        <h2 className="font-semibold">W-8 forms given to this client</h2>
        <p className="mt-1 text-sm text-slate-600">
          Send the client a signed {defaultForm} so they don&apos;t withhold US tax. It stays valid until 31 December of
          the third year after you sign it. Download the blank form from irs.gov.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {(w8s ?? []).map((w) => (
            <li key={w.id}>
              <b>{w.form_type}</b> signed {w.signed_on}, valid to {w.expires_on}
              {w.treaty_article && ` · Art. ${w.treaty_article}`}
            </li>
          ))}
          {!w8s?.length && <li className="text-slate-500">None recorded.</li>}
        </ul>
        <form action={addW8.bind(null, id)} className="mt-4 grid gap-4 sm:grid-cols-4">
          <Field label="Form">
            <select name="form_type" defaultValue={defaultForm} className={inputCls}>
              <option>W-8BEN</option>
              <option>W-8BEN-E</option>
            </select>
          </Field>
          <Field label="Signed on">
            <input name="signed_on" type="date" required className={inputCls} />
          </Field>
          <Field label="Treaty article claimed" hint="Optional, e.g. 12 for royalties">
            <input name="treaty_article" className={inputCls} />
          </Field>
          <Field label="Treaty rate (%)">
            <input name="treaty_rate_pct" type="number" min={0} max={30} step={0.01} className={inputCls} />
          </Field>
          <div className="sm:col-span-4">
            <button className={buttonCls}>Record W-8</button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="mb-4 font-semibold">Client details</h2>
        <form action={updateClient.bind(null, id)} className="space-y-4">
          <ClientFields c={client as ClientRow} />
          <button className={buttonCls}>Save</button>
        </form>
      </Card>
    </>
  );
}
