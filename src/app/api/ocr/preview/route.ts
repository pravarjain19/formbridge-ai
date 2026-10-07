import { NextResponse } from "next/server";
import { getOcrProvider, MAX_UPLOAD_BYTES, OcrProviderError, SUPPORTED_MIME, type SupportedMime } from "@/lib/ocr/providers";
import { validateExtraction } from "@/lib/ocr/validate";

/**
 * POST /api/ocr/preview  (multipart: file, docType?, servicesInUs?)
 *
 * Stateless extract + validate with no login and no database: for local
 * development and for the public "try it" page. Nothing is stored.
 * With a real provider it is disabled in production unless ALLOW_OCR_PREVIEW=true
 * (each call costs money, so add rate limiting before enabling it publicly).
 */

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const provider = getOcrProvider();
  if (provider.name !== "mock" && process.env.NODE_ENV === "production" && process.env.ALLOW_OCR_PREVIEW !== "true") {
    return NextResponse.json({ error: "preview_disabled" }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  if (!SUPPORTED_MIME.has(file.type)) return NextResponse.json({ error: "unsupported_file" }, { status: 415 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  const docType = (form?.get("docType") as string | null) || null;
  const servicesInUs = form?.get("servicesInUs");

  try {
    const result = await provider.extract({
      bytes: await file.arrayBuffer(),
      mimeType: file.type as SupportedMime,
      docTypeHint: docType,
    });
    if (!result.extraction) {
      return NextResponse.json(
        { error: result.stopReason === "refusal" ? "ocr_refused" : "ocr_invalid_output", provider: provider.name },
        { status: 422 },
      );
    }
    const issues = validateExtraction(result.extraction, {
      servicesPerformedInUs: servicesInUs == null ? undefined : servicesInUs === "true",
    });
    return NextResponse.json({
      provider: provider.name,
      model: result.servedByModel,
      extraction: result.extraction,
      issues,
    });
  } catch (err) {
    if (err instanceof OcrProviderError) {
      return NextResponse.json({ error: err.message, provider: provider.name }, { status: err.status });
    }
    console.error("ocr preview failed", err);
    return NextResponse.json({ error: "ocr_failed" }, { status: 500 });
  }
}
