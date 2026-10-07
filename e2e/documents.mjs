// End-to-end browser test. Needs: `npx supabase start` (local stack with Mailpit),
// the app running against it (`npm run build && npm start`), OCR_PROVIDER=mock.
// Run: BASE_URL=http://localhost:3000 node e2e/<file>.mjs   (CHROME_PATH optional)
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const MAILPIT = process.env.MAILPIT_URL || "http://127.0.0.1:54324";
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "formbridge-e2e-"));
const PDF = path.join(OUT, "slip.pdf");
fs.writeFileSync(PDF, `%PDF-1.4\n% sample ${Date.now()}\n`);
const base = process.env.BASE_URL || "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const step = async (name, fn) => { try { await fn(); console.log("OK  ", name); } catch (e) { console.log("FAIL", name, e.message.split("\n")[0]); await p.screenshot({ path: `${OUT}/fail-${name}.png`, fullPage: true }); process.exit(1); } };
console.log("artifacts in", OUT);
await step("login", async () => {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
  await p.goto(`${base}/login`); await p.fill("input[name=email]", "tester@example.com"); await p.click("text=Email me a sign-in link"); await p.waitForSelector("text=Check your inbox");
  let link; for (let i=0;i<20&&!link;i++){ await new Promise(r=>setTimeout(r,500)); const l=await (await fetch(`${MAILPIT}/api/v1/messages`)).json(); if(l.messages?.length){const m=await (await fetch(`${MAILPIT}/api/v1/message/${l.messages[0].ID}`)).json(); link=(m.Text.match(/https?:\/\/\S+/g)||[]).find(u=>u.includes("verify"));}}
  await p.goto(link); await p.waitForURL(/\/app$/);
});
await step("upload + OCR", async () => {
  await p.goto(`${base}/app/documents`);
  await p.setInputFiles("input[name=file]", PDF);
  await p.selectOption("select[name=client_id]", { index: 1 });
  await p.click("text=Upload and check");
  await p.waitForSelector("text=Done:", { timeout: 30000 });
  const html = await p.content();
  if (!html.includes("statutory rate")) throw new Error("validation issues not shown");
  if (!html.includes("needs review")) throw new Error("status not needs review");
  await p.screenshot({ path: `${OUT}/documents.png`, fullPage: true });
});
await step("duplicate upload rejected", async () => {
  await p.setInputFiles("input[name=file]", PDF);
  await p.click("text=Upload and check");
  await p.waitForSelector("text=already uploaded this exact file", { timeout: 15000 });
});
await step("deductions + FY split", async () => {
  await p.goto(`${base}/app/tax-credits`);
  await p.waitForSelector("text=Acme Robotics Inc.");
  const add = async (d, g, t, r) => {
    await p.fill("input[name=deducted_on]", d); await p.fill("input[name=gross_usd]", g);
    await p.fill("input[name=tax_usd]", t); await p.fill("input[name=sbi_tt_rate]", r);
    await p.click("form:has(input[name=deducted_on]) button:has-text('Add')"); await p.waitForSelector(`td:has-text('${d}')`, { timeout: 15000 });
  };
  await add("2025-03-15", "6000", "1800", "86");
  await add("2025-06-15", "18000", "5400", "85");
  const html = await p.content();
  for (const t of ["2024-25", "2025-26", "Form 67", "ready"]) if (!html.includes(t)) throw new Error("missing " + t);
  await p.screenshot({ path: `${OUT}/tax-credits.png`, fullPage: true });
});
await step("csv export", async () => {
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("a:has-text('CSV') >> nth=0")]);
  const csvPath = `${OUT}/ftc.csv`; await dl.saveAs(csvPath);
  console.log(fs.readFileSync(csvPath, "utf8"));
});
await b.close();
