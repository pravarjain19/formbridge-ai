import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOcrProvider,
  MAX_UPLOAD_BYTES as MAX_BYTES,
  OcrProviderError,
  SUPPORTED_MIME,
  type ExtractResult,
  type SupportedMime,
} from "@/lib/ocr/providers";
import { OCR_SCHEMA_VERSION, type OcrExtraction } from "@/lib/ocr/schema";
import { validateExtraction, type ValidationIssue } from "@/lib/ocr/validate";

/**
 * POST /api/documents/:id/parse
 *
 * Flow: the browser uploads the file straight to Storage (bucket 'tax-documents',
 * path '<uid>/<documentId>/<name>') and inserts the `documents` row; then it calls
 * this route. The route runs as the signed-in user, so RLS guarantees the
 * document belongs to the caller.
 *
 * Response: { documentId, ocrRunId, status, extraction, issues, withholdingId }
 */

export const runtime = "nodejs";
export const maxDuration = 300; // large scanned PDFs can take a while

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const jsonError = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  if (!UUID_RE.test(documentId)) return jsonError(400, "invalid_document_id");

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return jsonError(401, "unauthenticated");
  const userId = auth.user.id;

  // Claim the document atomically so double-clicks don't spawn parallel paid OCR runs.
  const { data: doc, error: claimError } = await supabase
    .from("documents")
    .update({ status: "processing" })
    .eq("id", documentId)
    .neq("status", "processing")
    .select("id, user_id, client_id, doc_type, storage_path, mime_type, size_bytes")
    .maybeSingle();
  if (claimError) return jsonError(500, "document_lookup_failed");
  if (!doc) {
    const { data: exists } = await supabase.from("documents").select("status").eq("id", documentId).maybeSingle();
    return exists ? jsonError(409, "already_processing") : jsonError(404, "document_not_found");
  }

  const releaseDocument = (status: "uploaded" | "failed") =>
    supabase.from("documents").update({ status }).eq("id", documentId);

  if (!SUPPORTED_MIME.has(doc.mime_type) || doc.size_bytes > MAX_BYTES) {
    await releaseDocument("failed");
    return jsonError(415, "unsupported_file");
  }

  const { data: blob, error: downloadError } = await supabase.storage.from("tax-documents").download(doc.storage_path);
  if (downloadError || !blob) {
    await releaseDocument("uploaded");
    return jsonError(502, "storage_download_failed");
  }
  const bytes = await blob.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    await releaseDocument("failed");
    return jsonError(413, "file_too_large");
  }

  const servicesPerformedInUs = doc.client_id
    ? (await supabase.from("clients").select("services_performed_in_us").eq("id", doc.client_id).maybeSingle()).data
        ?.services_performed_in_us
    : undefined;

  const provider = getOcrProvider();
  const { data: run, error: runError } = await supabase
    .from("ocr_runs")
    .insert({ document_id: documentId, user_id: userId, model: `${provider.name}:${provider.model}`, schema_version: OCR_SCHEMA_VERSION })
    .select("id")
    .single();
  if (runError || !run) {
    await releaseDocument("uploaded");
    return jsonError(500, "ocr_run_create_failed");
  }

  const started = Date.now();
  const finishRun = (fields: Record<string, unknown>) =>
    supabase
      .from("ocr_runs")
      .update({ ...fields, latency_ms: Date.now() - started, completed_at: new Date().toISOString() })
      .eq("id", run.id);

  // ---- Model call -----------------------------------------------------------
  let result: ExtractResult;
  try {
    result = await provider.extract({
      bytes,
      mimeType: doc.mime_type as SupportedMime,
      docTypeHint: doc.doc_type === "other" ? null : doc.doc_type,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRun({ status: "failed", error_message: message.slice(0, 2000) });
    await releaseDocument("uploaded");
    if (err instanceof OcrProviderError) {
      const code = { 429: "ocr_rate_limited", 422: "ocr_rejected_input", 502: "ocr_upstream_error" }[err.status];
      return jsonError(err.status, code, { retryable: err.retryable });
    }
    return jsonError(500, "ocr_failed");
  }

  if (result.stopReason === "refusal") {
    await finishRun({
      status: "refused",
      error_message: `refusal:${result.refusalCategory ?? "unknown"}`,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
    });
    await supabase.from("documents").update({ status: "needs_review", latest_ocr_run_id: run.id }).eq("id", documentId);
    return jsonError(422, "ocr_refused", { ocrRunId: run.id });
  }

  if (!result.extraction) {
    await finishRun({
      status: "invalid_output",
      error_message: `stop_reason:${result.stopReason}`,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
    });
    await supabase.from("documents").update({ status: "needs_review", latest_ocr_run_id: run.id }).eq("id", documentId);
    return jsonError(422, "ocr_invalid_output", { ocrRunId: run.id });
  }

  // ---- Deterministic validation ---------------------------------------------
  const extraction = result.extraction;
  const issues = validateExtraction(extraction, { servicesPerformedInUs });
  const blocking = issues.some((i) => i.severity === "error") || extraction.overall_confidence < 0.85;

  await finishRun({
    status: "succeeded",
    model: `${provider.name}:${result.servedByModel}`,
    detected_doc_type: extraction.detected_doc_type,
    extracted: extraction,
    validation_issues: issues,
    overall_confidence: clamp01(extraction.overall_confidence),
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
  });

  // ---- Persist a withholding record for 1042-S slips -------------------------
  const withholdingId = await upsertWithholding(supabase, {
    userId,
    documentId,
    clientId: doc.client_id,
    ocrRunId: run.id,
    extraction,
  });

  const taxYear = extraction.form_1042s?.tax_year ?? extraction.form_1099?.tax_year ?? null;
  await supabase
    .from("documents")
    .update({
      status: blocking ? "needs_review" : "parsed",
      latest_ocr_run_id: run.id,
      ...(extraction.detected_doc_type !== "other" ? { doc_type: extraction.detected_doc_type } : {}),
      ...(taxYear ? { tax_year: taxYear } : {}),
    })
    .eq("id", documentId);

  return NextResponse.json({
    documentId,
    ocrRunId: run.id,
    status: blocking ? "needs_review" : "parsed",
    extraction,
    issues,
    withholdingId,
  } satisfies ParseResponse);
}

interface ParseResponse {
  documentId: string;
  ocrRunId: string;
  status: "parsed" | "needs_review";
  extraction: OcrExtraction;
  issues: ValidationIssue[];
  withholdingId: string | null;
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function upsertWithholding(
  supabase: Supabase,
  a: { userId: string; documentId: string; clientId: string | null; ocrRunId: string; extraction: OcrExtraction },
): Promise<string | null> {
  const f = a.extraction.form_1042s;
  if (!f || f.tax_year == null || f.box2_gross_income == null) return null;

  // FX conversion (SBI TT buying rate, last day of the month before deduction) and
  // Indian FY need the actual payment date, which a 1042-S doesn't carry; those are
  // filled in when the slip is matched to remittance advices in the reconciler.
  const row = {
    user_id: a.userId,
    client_id: a.clientId,
    source_document_id: a.documentId,
    source_ocr_run_id: a.ocrRunId,
    us_tax_year: f.tax_year,
    unique_form_identifier: f.unique_form_identifier,
    is_amended: f.is_amended ?? false,
    income_code: f.box1_income_code,
    gross_income_usd: f.box2_gross_income,
    chapter_indicator: f.box3_chapter_indicator === 3 || f.box3_chapter_indicator === 4 ? f.box3_chapter_indicator : null,
    ch3_exemption_code: f.box3a_ch3_exemption_code,
    ch3_tax_rate_pct: f.box3b_ch3_tax_rate,
    federal_tax_withheld_usd: f.box7a_federal_tax_withheld ?? 0,
    total_withholding_credit_usd: f.box10_total_withholding_credit,
    withholding_agent_ein: f.box12a_withholding_agent_ein,
    withholding_agent_name: f.box12d_withholding_agent_name,
    recipient_country_code: f.box13b_recipient_country_code,
    recipient_foreign_tin: maskTin(f.box13i_recipient_foreign_tin),
    ftc_status: (f.box7a_federal_tax_withheld ?? 0) > 0 ? "pending" : "not_applicable",
  };

  // Re-parsing the same document updates its row instead of duplicating it.
  const { data: existing } = await supabase
    .from("tax_withholdings")
    .select("id")
    .eq("source_document_id", a.documentId)
    .maybeSingle();

  const query = existing
    ? supabase.from("tax_withholdings").update(row).eq("id", existing.id).select("id").single()
    : supabase.from("tax_withholdings").insert(row).select("id").single();

  const { data, error } = await query;
  if (error) {
    // 23505 = same UFI already recorded from another upload of this slip; keep the first.
    if (error.code !== "23505") console.error("tax_withholdings upsert failed", error.message);
    return null;
  }
  return data.id;
}

/** Keep PAN-shaped TINs masked at rest: ABCDE1234F -> ABCDE****F. */
function maskTin(tin: string | null): string | null {
  if (!tin) return null;
  const t = tin.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(t) ? `${t.slice(0, 5)}****${t.slice(9)}` : `****${t.slice(-4)}`;
}
