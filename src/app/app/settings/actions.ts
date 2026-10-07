"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod/v4";
import { hashPan, isValidPan, maskPan } from "@/lib/pii";
import { requireUser } from "@/lib/supabase/server";

const back = (q: string) => redirect(`/app/settings?${q}`);
const blankToNull = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);

const ProfileForm = z.object({
  legal_name: z.string().min(1, "Legal name is required").max(200),
  trade_name: z.string().max(200).nullable(),
  entity_kind: z.enum(["individual", "proprietorship", "llp", "private_limited", "other"]),
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "GSTIN format is invalid")
    .nullable(),
  pan: z.string().nullable(),
  address_line: z.string().max(500).nullable(),
  city: z.string().max(100).nullable(),
  state: z.string().max(100).nullable(),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "PIN code must be 6 digits").nullable(),
});

export async function saveProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = ProfileForm.safeParse({
    legal_name: blankToNull(formData.get("legal_name")) ?? "",
    trade_name: blankToNull(formData.get("trade_name")),
    entity_kind: formData.get("entity_kind"),
    gstin: blankToNull(formData.get("gstin"))?.toUpperCase() ?? null,
    pan: blankToNull(formData.get("pan")),
    address_line: blankToNull(formData.get("address_line")),
    city: blankToNull(formData.get("city")),
    state: blankToNull(formData.get("state")),
    pincode: blankToNull(formData.get("pincode")),
  });
  if (!parsed.success) back(`error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const f = parsed.data!;

  const update: Record<string, unknown> = {
    legal_name: f.legal_name,
    trade_name: f.trade_name,
    entity_kind: f.entity_kind,
    gstin: f.gstin,
    state_code: f.gstin ? f.gstin.slice(0, 2) : null,
    address: { line: f.address_line, city: f.city, state: f.state, pincode: f.pincode, country: "India" },
  };
  // PAN is write-only: only replace it when a new one is typed.
  if (f.pan) {
    if (!isValidPan(f.pan)) back("error=PAN%20format%20is%20invalid");
    update.pan_masked = maskPan(f.pan);
    update.pan_hash = hashPan(f.pan);
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) back(`error=${encodeURIComponent(error.message)}`);
  revalidatePath("/app", "layout");
  back("ok=Profile%20saved");
}

const LutForm = z.object({
  financial_year: z.string().regex(/^[0-9]{4}-[0-9]{2}$/, "Financial year must look like 2026-27"),
  arn: z.string().min(5, "ARN is required").max(30),
  filed_on: z.iso.date("Filing date is required"),
});

export async function addLut(formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = LutForm.safeParse({
    financial_year: formData.get("financial_year"),
    arn: blankToNull(formData.get("arn"))?.toUpperCase() ?? "",
    filed_on: formData.get("filed_on"),
  });
  if (!parsed.success) back(`error=${encodeURIComponent(parsed.error.issues[0].message)}`);

  const { error } = await supabase
    .from("lut_registrations")
    .upsert({ user_id: user.id, ...parsed.data! }, { onConflict: "user_id,financial_year" });
  if (error) back(`error=${encodeURIComponent(error.message)}`);
  revalidatePath("/app", "layout");
  back("ok=LUT%20saved");
}
