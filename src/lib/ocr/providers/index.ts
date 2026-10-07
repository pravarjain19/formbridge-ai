import { claudeProvider } from "./claude";
import { geminiProvider } from "./gemini";
import { mockProvider } from "./mock";
import type { OcrProvider } from "./types";

export * from "./types";

/**
 * OCR_PROVIDER=claude | gemini | mock. When unset, use whichever key is
 * configured (Claude first), falling back to the offline mock.
 */
export function getOcrProvider(): OcrProvider {
  switch (process.env.OCR_PROVIDER?.toLowerCase()) {
    case "claude":
      return claudeProvider;
    case "gemini":
      return geminiProvider;
    case "mock":
      return mockProvider;
  }
  if (process.env.ANTHROPIC_API_KEY) return claudeProvider;
  if (process.env.GEMINI_API_KEY) return geminiProvider;
  return mockProvider;
}
