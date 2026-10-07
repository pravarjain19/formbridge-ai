# FormBridge.ai

US–India cross-border compliance for Indian freelancers, contractors and agencies. This module contains the database schema and the AI document-OCR engine.

- `docs/RESEARCH.md`: verified 2026 rules (Form 67 → 44, 26AS → 168, W-8BEN, GST LUT) and the field-level reconciliation map.
- `supabase/schema.sql`: tables, enums, generated columns, RLS policies and the private `tax-documents` Storage bucket.
- `src/app/api/documents/[id]/parse/route.ts`: `POST` route. It loads an uploaded 1042-S, 1099 or remittance advice and extracts it with Claude structured outputs. It then runs deterministic validation and writes `ocr_runs` and `tax_withholdings`.
- `src/lib/ocr/`: the Zod extraction schema, the validation rules, and `providers/` (Claude, Gemini, offline mock).
- `src/app/page.tsx` + `POST /api/ocr/preview`: upload a document and see the extraction and checks, with no login or database.

## Try it locally (no keys needed)

```bash
npm install
cp .env.example .env.local   # OCR_PROVIDER=mock by default
npm run dev                  # open http://localhost:3000
```

Upload any PDF or image. In mock mode you get a sample 1042-S result so you can see the checks. Set `OCR_PROVIDER=gemini` with a free `GEMINI_API_KEY` (dummy documents only) or `OCR_PROVIDER=claude` with `ANTHROPIC_API_KEY` to read real files.

## Full setup

```bash
git clone https://github.com/pravarjain19/formbridge-ai.git
cd formbridge-ai
cp .env.example .env.local   # fill in Supabase + Anthropic keys
npm install
# Supabase SQL editor: run supabase/schema.sql
npm run dev
```

## Upload → parse flow

1. The client uploads the file to `tax-documents/<uid>/<documentId>/<filename>` and inserts a `documents` row with the same id.
2. The client calls `POST /api/documents/<documentId>/parse`.
3. The route returns `{ status: "parsed" | "needs_review", extraction, issues, withholdingId }`.
