import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { OcrExtraction } from "../schema";
import { OcrProviderError, SYSTEM_PROMPT, userInstruction, type ExtractInput, type OcrProvider } from "./types";

const MODEL = process.env.FORMBRIDGE_OCR_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic()); // reads ANTHROPIC_API_KEY on first use

export const claudeProvider: OcrProvider = {
  name: "claude",
  model: MODEL,
  async extract({ bytes, mimeType, docTypeHint }: ExtractInput) {
    const data = Buffer.from(bytes).toString("base64");
    const fileBlock: BetaContentBlockParam =
      mimeType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
        : { type: "image", source: { type: "base64", media_type: mimeType, data } };

    try {
      const response = await anthropic().beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        output_config: { effort: "medium", format: betaZodOutputFormat(OcrExtraction) },
        // Server-side refusal fallback: if a safety classifier declines, the API
        // reruns the request on a fallback model inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: [{ role: "user", content: [fileBlock, { type: "text", text: userInstruction(docTypeHint) }] }],
      });

      return {
        extraction: response.stop_reason === "refusal" ? null : response.parsed_output ?? null,
        stopReason: response.stop_reason,
        refusalCategory: response.stop_details?.category ?? null,
        servedByModel: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) throw new OcrProviderError(err.message, 429, true);
      if (err instanceof Anthropic.BadRequestError) throw new OcrProviderError(err.message, 422, false);
      if (err instanceof Anthropic.APIError) throw new OcrProviderError(err.message, 502, true);
      throw err;
    }
  },
};
