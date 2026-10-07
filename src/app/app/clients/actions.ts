"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod/v4";
import { requireUser } from "@/lib/supabase/server";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);

const ClientForm = z.object({
  legal_name: z.string().min(1, "Client name is required").max(200),
  country_code: z.string().regex(/^[A-Z]{2}$/, "Country must be a 2-letter code"),
  us_ein: z.string().regex(/^[0-9]{2}-?[0-9]{7}$/, "EIN must look like 12-3456789").nullable(),
  billing_email: z.email("Billing email is invalid").nullable(),
  ap_contact_name: z.string().max(200).nullable(),
  vendor_id: z.string().max(100).nullable(),
  payment_terms_days: z.coerce.number().int().min(0).max(180),
  po_required: z.boolean(),
  services_performed_in_us: z.boolean(),
  address: z.object({
    line: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    zip: z.string().nullable(),
  }),
});

function parseClient(fd: FormData) {
  return ClientForm.safeParse({
    legal_name: str(fd.get("legal_name")) ?? "",
    country_code: (str(fd.get("country_code")) ?? "US").toUpperCase(),
    us_ein: str(fd.get("us_ein")),
    billing_email: str(fd.get("billing_email")),
    ap_contact_name: str(fd.get("ap_contact_name")),
    vendor_id: str(fd.get("vendor_id")),
    payment_terms_days: str(fd.get("payment_terms_days")) ?? "30",
    po_required: fd.get("po_required") === "on",
    services_performed_in_us: fd.get("services_performed_in_us") === "on",
    address: {
      line: str(fd.get("address_line")),
      city: str(fd.get("city")),
      state: str(fd.get("state")),
      zip: str(fd.get("zip")),
    },
  });
}

export async function createClient(fd: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = parseClient(fd);
  if (!parsed.success) redirect(`/app/clients?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data!, user_id: user.id })
    .select("id")
    .single();
  if (error) redirect(`/app/clients?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/app/clients");
  redirect(`/app/clients/${data!.id}?ok=Client%20added.%20Now%20record%20the%20W-8%20you%20sent%20them.`);
}

export async function updateClient(id: string, fd: FormData) {
  const { supabase } = await requireUser();
  const parsed = parseClient(fd);
  if (!parsed.success) redirect(`/app/clients/${id}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { error } = await supabase.from("clients").update(parsed.data!).eq("id", id);
  if (error) redirect(`/app/clients/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/app/clients/${id}`);
  redirect(`/app/clients/${id}?ok=Saved`);
}

const W8Form = z.object({
  form_type: z.enum(["W-8BEN", "W-8BEN-E"]),
  signed_on: z.iso.date("Signing date is required"),
  treaty_article: z.string().max(20).nullable(),
  treaty_rate_pct: z.coerce.number().min(0).max(30).nullable(),
  income_type_claimed: z.string().max(200).nullable(),
});

export async function addW8(clientId: string, fd: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = W8Form.safeParse({
    form_type: fd.get("form_type"),
    signed_on: fd.get("signed_on"),
    treaty_article: str(fd.get("treaty_article")),
    treaty_rate_pct: str(fd.get("treaty_rate_pct")),
    income_type_claimed: str(fd.get("income_type_claimed")),
  });
  if (!parsed.success) redirect(`/app/clients/${clientId}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { error } = await supabase
    .from("w8_certifications")
    .insert({ ...parsed.data!, client_id: clientId, user_id: user.id, treaty_country: "IN" });
  if (error) redirect(`/app/clients/${clientId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath("/app");
  redirect(`/app/clients/${clientId}?ok=W-8%20recorded`);
}
