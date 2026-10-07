import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { buttonCls, Card, Flash, PageTitle } from "../ui";
import { createClient } from "./actions";
import { ClientFields } from "./client-fields";
import { W8Status } from "./w8-status";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireUser();
  const { error } = await searchParams;
  const { data: clients } = await supabase
    .from("clients")
    .select("id, legal_name, country_code, w8_certifications(form_type, expires_on)")
    .order("legal_name");

  return (
    <>
      <PageTitle title="Clients & W-8 forms" />
      <Flash error={error} />
      <Card>
        {clients?.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Client</th>
                <th className="pb-2">Country</th>
                <th className="pb-2">W-8 status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const w8s = (c.w8_certifications ?? []) as { form_type: string; expires_on: string }[];
                const latest = w8s.sort((a, b) => b.expires_on.localeCompare(a.expires_on))[0] ?? null;
                return (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="py-2">
                      <Link href={`/app/clients/${c.id}`} className="font-medium underline">
                        {c.legal_name}
                      </Link>
                    </td>
                    <td className="py-2">{c.country_code}</td>
                    <td className="py-2">
                      <W8Status latest={latest} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">No clients yet. Add your first US client below.</p>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="mb-4 font-semibold">Add a client</h2>
        <form action={createClient} className="space-y-4">
          <ClientFields />
          <button className={buttonCls}>Add client</button>
        </form>
      </Card>
    </>
  );
}
