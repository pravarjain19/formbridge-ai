"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod/v4";
import { requireUser } from "@/lib/supabase/server";

const PATH = "/app/tax-credits";
const str = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);
const fail = (msg: string): never => redirect(`${PATH}?error=${encodeURIComponent(msg)}`);

const SlipForm = z.object({
  client_id: z.uuid().nullable(),
  us_tax_year: z.coerce.number().int().min(2015).max(2100),
  withholding_agent_name: z.string().min(1, "Withholding agent is required").max(200),
  income_code: z.string().max(4).nullable(),
  gross_income_usd: z.coerce.number().min(0),
  federal_tax_withheld_usd: z.coerce.number().min(0),
});

/** Manual entry for a slip that wasn't uploaded. */
export async function addSlip(fd: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = SlipForm.safeParse({
    client_id: str(fd.get("client_id")),
    us_tax_year: fd.get("us_tax_year"),
    withholding_agent_name: str(fd.get("withholding_agent_name")) ?? "",
    income_code: str(fd.get("income_code")),
    gross_income_usd: fd.get("gross_income_usd"),
    federal_tax_withheld_usd: fd.get("federal_tax_withheld_usd"),
  });
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const { error } = await supabase.from("tax_withholdings").insert({
    ...parsed.data!,
    user_id: user.id,
    ftc_status: parsed.data!.federal_tax_withheld_usd > 0 ? "pending" : "not_applicable",
  });
  if (error) fail(error.message);
  revalidatePath(PATH);
  redirect(PATH);
}

const DeductionForm = z.object({
  deducted_on: z.iso.date("Deduction date is required"),
  gross_usd: z.coerce.number().min(0),
  tax_usd: z.coerce.number().min(0),
  sbi_tt_rate: z.coerce.number().positive().nullable(),
});

export async function addDeduction(withholdingId: string, fd: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = DeductionForm.safeParse({
    deducted_on: fd.get("deducted_on"),
    gross_usd: fd.get("gross_usd"),
    tax_usd: fd.get("tax_usd"),
    sbi_tt_rate: str(fd.get("sbi_tt_rate")),
  });
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const { error } = await supabase
    .from("withholding_deductions")
    .insert({ ...parsed.data!, withholding_id: withholdingId, user_id: user.id });
  if (error) fail(error.message);
  await refreshStatus(withholdingId);
  revalidatePath(PATH);
  redirect(PATH);
}

export async function deleteDeduction(withholdingId: string, deductionId: string) {
  const { supabase } = await requireUser();
  await supabase.from("withholding_deductions").delete().eq("id", deductionId);
  await refreshStatus(withholdingId);
  revalidatePath(PATH);
  redirect(PATH);
}

/** A slip is 'ready' for Form 67/44 once its deductions add up to Box 7a and all have TT rates. */
async function refreshStatus(withholdingId: string) {
  const { supabase } = await requireUser();
  const [{ data: slip }, { data: rows }] = await Promise.all([
    supabase.from("tax_withholdings").select("federal_tax_withheld_usd, ftc_status").eq("id", withholdingId).single(),
    supabase.from("withholding_deductions").select("tax_usd, sbi_tt_rate").eq("withholding_id", withholdingId),
  ]);
  if (!slip || slip.ftc_status === "filed" || slip.ftc_status === "not_applicable") return;
  const total = (rows ?? []).reduce((s, r) => s + Number(r.tax_usd), 0);
  const complete =
    Math.abs(total - Number(slip.federal_tax_withheld_usd)) < 0.01 && (rows ?? []).every((r) => r.sbi_tt_rate);
  await supabase
    .from("tax_withholdings")
    .update({ ftc_status: complete ? "ready" : "pending" })
    .eq("id", withholdingId);
}
