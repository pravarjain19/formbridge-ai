import * as z from "zod/v4";
import { OcrExtraction } from "../schema";
import { OcrProviderError, SYSTEM_PROMPT, userInstruction, type ExtractInput, type OcrProvider } from "./types";

/**
 * Google Gemini via the REST generateContent endpoint with a JSON-schema
 * constrained response.
 *
 * WARNING: on Gemini's free tier, Google may use prompts and outputs to improve
 * its models and human reviewers may read them. Use only dummy or fully masked
 * documents on a free key; use a paid key (or Claude) for real user data.
 */
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const RESPONSE_SCHEMA = z.toJSONSchema(OcrExtraction, { target: "draft-7" });

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  modelVersion?: string;
}

export const geminiProvider: OcrProvider = {
  name: "gemini",
  model: MODEL,
  async extract({ bytes, mimeType, docTypeHint }: ExtractInput) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new OcrProviderError("GEMINI_API_KEY is not set", 502, false);

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: Buffer.from(bytes).toString("base64") } },
              { text: userInstruction(docTypeHint) },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      if (res.status === 429) throw new OcrProviderError(`Gemini rate limit: ${detail}`, 429, true);
      if (res.status === 400) throw new OcrProviderError(`Gemini rejected input: ${detail}`, 422, false);
      throw new OcrProviderError(`Gemini HTTP ${res.status}: ${detail}`, 502, res.status >= 500);
    }

    const body = (await res.json()) as GeminiResponse;
    const candidate = body.candidates?.[0];
    const usage = {
      servedByModel: body.modelVersion ?? MODEL,
      inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
    };

    const blocked = body.promptFeedback?.blockReason ?? (candidate?.finishReason === "SAFETY" ? "SAFETY" : null);
    if (blocked) return { extraction: null, stopReason: "refusal", refusalCategory: blocked, ...usage };

    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { extraction: null, stopReason: candidate?.finishReason ?? "invalid_json", refusalCategory: null, ...usage };
    }
    const checked = OcrExtraction.safeParse(parsed);
    return {
      extraction: checked.success ? checked.data : null,
      stopReason: checked.success ? (candidate?.finishReason ?? "STOP") : "schema_mismatch",
      refusalCategory: null,
      ...usage,
    };
  },
};
