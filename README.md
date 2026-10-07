# FormBridge.ai

US–India cross-border compliance for Indian freelancers, contractors and agencies with US clients:
- GST export invoices;
- W-8BEN tracking;
- US withholding checks;
- foreign tax credit (Form 67 / Form 44).

## What's in it

| Area | Where | What it does |
|---|---|---|
| DTAA calculator | `/calculator` | Correct US withholding, which W-8 / 8233 form to send, exposure without paperwork, estimated Indian FTC. No login. |
| 1042-S check | `/` + `POST /api/ocr/preview` | Upload a 1042-S, 1099 or remittance advice. AI extraction plus rule checks. No login, nothing stored. |
| Guides (SEO) | `/guides/*`, `sitemap.xml`, `robots.txt` | Five long-tail pages, each ending in a tool. |
| Login | `/login` | Email magic link via Supabase Auth. |
| Dashboard | `/app` | FY totals, LUT status, W-8 expiry and review to-dos. |
| Clients & W-8 | `/app/clients` | Client master, W-8BEN / W-8BEN-E records with expiry. |
| Invoices | `/app/invoices` | GST Rule 46 export invoice (LUT/IGST, SAC, INR value), print/PDF, payments with FIRC. |
| Documents | `/app/documents` | Upload to private storage, OCR, validation issues, re-check. |
| Tax credits | `/app/tax-credits` | Split 1042-S into dated deductions, SBI TT rate, credit per Indian FY, CSV for Form 67/44. |
| Billing | `/app/billing`, `/api/razorpay/*` | Razorpay subscriptions (Free / Pro / Agency), webhook, monthly document-check quota. |

**Code layout:**
- `supabase/schema.sql`: all tables, row-level security, storage bucket and policies. Idempotent, so re-run it after pulling.
- `src/lib/ocr/`: extraction schema, validation rules, and the providers (Claude, Gemini, offline mock).
- `src/lib/tax/`: DTAA, FTC and date rules. `src/lib/invoice.ts`: invoice rules.
- `docs/RESEARCH.md`: the verified 2026 tax rules. `docs/GO-TO-MARKET.md`: the SEO, community and cold-email playbook.

## Run it locally

**1. Quickest start: no accounts, no keys.** The calculator, the 1042-S check (mock data) and the guides work right away:
```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

**2. Full app** (dashboard, invoices, uploads) needs Supabase. Pick one:

**Option A: Supabase cloud.** The free plan is enough.
1. Create a project at supabase.com.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy the project URL and the publishable key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Older projects use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead.
4. Under Authentication → URL Configuration, set Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the redirect URLs.

**Option B: Supabase on your computer** (needs Docker Desktop running):
```bash
npm run db:start   # starts Supabase, loads supabase/schema.sql, writes .env.local
npm run dev        # http://localhost:3000
```
- Login emails land in Mailpit at http://127.0.0.1:54324.
- The database UI (Studio) is at http://127.0.0.1:54323.
- `npm run db:reset` wipes the data and re-applies the schema. `npm run db:stop` stops it.

**3. AI document reading:** set `OCR_PROVIDER` in `.env.local`:
- `mock`: sample data, free.
- `gemini` + `GEMINI_API_KEY`: free tier. Use dummy documents only, because Google may use free-tier inputs.
- `claude` + `ANTHROPIC_API_KEY`: for real user data.

**4. Payments:**
1. In Razorpay, create two monthly plans (₹499 and ₹1,999).
2. Set `RAZORPAY_*`, `SUPABASE_SERVICE_ROLE_KEY` and `PAN_HASH_SECRET`.
3. Point a webhook at `/api/razorpay/webhook` with the subscription events.

## Tests

```bash
npm test           # unit tests: DTAA, FTC, invoice rules, dates, Razorpay signatures
npm run typecheck
# End-to-end (local Supabase running, app built with OCR_PROVIDER=mock and started):
npm run build && npm start &
npm run e2e        # login, settings, LUT, client, W-8, invoice, payment, upload, FTC, CSV
```

## Deploy

1. Push to GitHub and import the repo in Vercel.
2. Set the same env vars, plus `NEXT_PUBLIC_SITE_URL`.
3. Add `https://<your-domain>/auth/callback` to the Supabase redirect URLs.

> Tax logic is an estimate for planning, not advice. Have a CA review `docs/RESEARCH.md` and `src/lib/tax/` before launch, and re-verify every April.
