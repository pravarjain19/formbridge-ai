// End-to-end browser test. Needs: `npx supabase start` (local stack with Mailpit),
// the app running against it (`npm run build && npm start`), OCR_PROVIDER=mock.
// Run: BASE_URL=http://localhost:3000 node e2e/<file>.mjs   (CHROME_PATH optional)
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const MAILPIT = process.env.MAILPIT_URL || "http://127.0.0.1:54324";
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "formbridge-e2e-"));
const base = process.env.BASE_URL || "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
const p = await ctx.newPage();
const step = async (name, fn) => { try { await fn(); console.log("OK  ", name, "->", p.url()); } catch (e) { console.log("FAIL", name, e.message.split("\n")[0]); await p.screenshot({ path: `${OUT}/fail-${name}.png`, fullPage: true }); throw e; } };
console.log("artifacts in", OUT);
const flash = async () => (await p.locator(".bg-red-50").allTextContents()).join(" | ");

await step("login", async () => {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
  await p.goto(`${base}/app`);
  await p.fill("input[name=email]", "tester@example.com");
  await p.click("text=Email me a sign-in link");
  await p.waitForSelector("text=Check your inbox");
  let link;
  for (let i = 0; i < 20 && !link; i++) {
    await new Promise(r => setTimeout(r, 500));
    const list = await (await fetch(`${MAILPIT}/api/v1/messages`)).json();
    if (list.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      link = (msg.Text.match(/https?:\/\/\S+/g) || []).find(u => u.includes("verify"));
    }
  }
  if (!link) throw new Error("no magic link email");
  await p.goto(link.replace(/&amp;/g, "&"));
  await p.waitForURL(/\/app$/);
});
await step("settings", async () => {
  await p.goto(`${base}/app/settings`);
  await p.fill("input[name=legal_name]", "Priya Sharma");
  await p.fill("input[name=gstin]", "27ABCDE1234F1Z5");
  await p.fill("input[name=pan]", "ABCDE1234F");
  await p.fill("input[name=address_line]", "12 MG Road");
  await p.fill("input[name=city]", "Pune");
  await p.fill("input[name=state]", "Maharashtra");
  await p.fill("input[name=pincode]", "411001");
  await p.click("text=Save profile");
  await p.waitForSelector("text=Profile saved");
  await p.fill("input[name=arn]", "AD270426012345X");
  await p.fill("input[name=filed_on]", "2026-04-02");
  await p.click("text=Save LUT");
  await p.waitForSelector("text=LUT saved");
  if (!(await p.content()).includes("ABCDE****F")) throw new Error("masked PAN not shown");
});
let clientUrl;
await step("client", async () => {
  await p.goto(`${base}/app/clients`);
  await p.fill("input[name=legal_name]", "Acme Robotics Inc.");
  await p.fill("input[name=us_ein]", "12-3456789");
  await p.fill("input[name=billing_email]", "ap@acme.example");
  await p.fill("input[name=vendor_id]", "V-10023");
  await p.fill("input[name=address_line]", "500 Market St");
  await p.fill("input[name=city]", "San Francisco");
  await p.fill("input[name=state]", "CA");
  await p.fill("input[name=zip]", "94105");
  await p.click("text=Add client");
  await p.waitForSelector("text=Client added", { timeout: 10000 }).catch(async () => { throw new Error("no ok: " + await flash()); });
  clientUrl = p.url();
  await p.fill("input[name=signed_on]", "2026-01-15");
  await p.click("text=Record W-8");
  await p.waitForSelector("text=valid to 2029-12-31");
});
await step("invoice", async () => {
  await p.goto(`${base}/app/invoices/new`);
  await p.fill("[aria-label='Description'] >> nth=0", "Backend development, April 2026");
  await p.fill("[aria-label='Quantity'] >> nth=0", "80");
  await p.fill("[aria-label='Unit price'] >> nth=0", "45.5");
  await p.click("text=+ Add line");
  await p.fill("[aria-label='Description'] >> nth=1", "Cloud hosting pass-through");
  await p.fill("[aria-label='Unit price'] >> nth=1", "120");
  await p.fill("input[name=fx_rate_inr]", "84.25");
  await p.fill("input[name=invoice_date]", "2026-04-30");
  await p.click("button:has-text('Issue invoice')");
  await p.waitForURL(/\/app\/invoices\/[0-9a-f-]{36}$/, { timeout: 15000 }).catch(async () => { throw new Error("not redirected: " + await flash()); });
  const html = await p.content();
  for (const t of ["FB/26-27/001", "USD 3,760.00", "₹3,16,780.00", "LETTER OF UNDERTAKING", "AD270426012345X", "V-10023"]) if (!html.includes(t)) throw new Error("missing " + t);
  await p.screenshot({ path: `${OUT}/invoice.png`, fullPage: true });
});
await step("payment", async () => {
  await p.fill("input[name=received_on]", "2026-05-20");
  await p.fill("input[name=intermediary_fees_fcy]", "25");
  await p.fill("input[name=amount_inr_credited]", "314500");
  await p.fill("input[name=firc_number]", "FIRC-88812");
  await p.click("text=Record payment");
  await p.waitForSelector("text=FIRC FIRC-88812");
  await p.goto(`${base}/app/invoices`);
  await p.waitForSelector("text=paid");
});
await step("duplicate number rejected", async () => {
  await p.goto(`${base}/app/invoices/new`);
  await p.fill("input[name=invoice_number]", "FB/26-27/001");
  await p.fill("[aria-label='Description'] >> nth=0", "x");
  await p.fill("[aria-label='Unit price'] >> nth=0", "1");
  await p.fill("input[name=invoice_date]", "2026-05-01");
  await p.click("button:has-text('Issue invoice')");
  await p.waitForSelector("text=already used");
});
await step("overview", async () => {
  await p.goto(`${base}/app`);
  await p.waitForSelector("text=On file");
  await p.screenshot({ path: `${OUT}/overview.png`, fullPage: true });
});
await b.close();
