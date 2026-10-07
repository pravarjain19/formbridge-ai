# FormBridge.ai: zero-budget go-to-market

Three channels, all pointing at free tools that already exist in the app:
- the DTAA calculator (`/calculator`);
- the 1042-S check (`/`);
- the five guides (`/guides/*`).

The free plan is the lead magnet. Pro (₹499/month) and Agency (₹1,999/month) are the upsell.

## 1. Long-tail SEO

Five pages are live, one per high-intent query:

| Query | Page | Tool it ends in |
|---|---|---|
| generate GST export invoice for US client | `/guides/gst-export-invoice-for-us-client` | Invoice generator |
| how to file Form 67 for US tax deduction | `/guides/how-to-file-form-67-us-tax-deducted` | 1042-S check |
| W-8BEN form for Indian freelancers | `/guides/w8ben-for-indian-freelancers` | DTAA calculator |
| US client deducted 30% tax Indian freelancer | `/guides/us-client-withheld-30-percent-tax` | 1042-S check |
| LUT for export of services GST 2026-27 | `/guides/lut-for-export-of-services-2026-27` | LUT in Settings |

Every page uses the same high-converting structure:
1. **H1 = the query.**
2. **A "Short answer" box** that answers the question in one paragraph. This targets the featured snippet.
3. **Numbered steps.** Searchers come with a task.
4. **A dark CTA block** linking to the matching tool ("Free to start. No card needed.").
5. **FAQ with `FAQPage` JSON-LD,** plus `Article` schema with `dateModified`.
6. **Related guides** for internal linking, and the canonical URL, sitemap and robots rules.

**Next 10 pages to add**, each as a new entry in `src/content/guides.ts`:
- Form 44 vs Form 67
- Form 168 vs 26AS
- SAC code for software export
- Is a FIRC mandatory for freelancers?
- W-8BEN-E for Indian private limited companies
- Form 8233 for Indians working in the US
- Schedule FSI and TR walkthrough
- e-BRC for services
- Purpose code P0802
- The 1042-S income codes explained

**Seasonality:**
- **April:** LUT renewal, so push the LUT guide.
- **February–March:** 1042-S season (US deadline 15 March).
- **June–July:** ITR season, so push Form 67/44.

## 2. Community marketing (Reddit, IndieHackers)

**Ground rules.** Breaking these gets the account banned and the domain flagged:
- Follow each subreddit's self-promotion rules. Most expect at least 9 helpful comments for every 1 that mentions your product.
- Always disclose: "I built a free tool for this (disclosure: it's mine)".
- Answer the question fully in the comment itself. The link is optional extra help, never the answer.
- **Do not scrape or auto-post.** Monitor instead. Reddit's terms restrict automated collection, and bot-like posting is the fastest way to a shadow ban.

**Monitoring (free):**
- **F5Bot** (free email alerts for Reddit and Hacker News keywords). Track: `W-8BEN`, `1042-S`, `Form 67`, `foreign tax credit`, `LUT export`, `US client tax`, `30% withholding`, `Upwork tax India`, `Deel India tax`.
- **Subreddits:** r/developersIndia, r/IndiaTax, r/personalfinanceindia, r/freelance_forhire, r/IndianStartups, r/digitalnomad (India threads), plus IndieHackers' "Ask IH".
- **Daily 20-minute routine:** answer 3 threads properly. Mention the tool only where it directly solves the asker's problem.

**Reply template** (adapt it every time, never paste it verbatim):
> If you did the work from India, the income is foreign-source for US purposes, so your client shouldn't withhold anything once they have your W-8BEN (individuals) / W-8BEN-E (companies). Fill Part I, put your PAN on line 6a, skip Part II unless you're getting royalties. If they already withheld 30%, ask them to fix it this year; otherwise it's a 1040-NR refund. Don't just claim it in Form 67, because India only credits treaty-compliant tax.
> I got tired of explaining this so I built a free calculator that tells you the right rate and form: [link] (disclosure: I made it).

**IndieHackers:** run a "building in public" thread with weekly numbers: visitors, calculator runs, sign-ups, MRR. Post one data deep-dive in the form "I analysed N Indian freelancers' 1042-S forms: X% were over-withheld". Publish it only once you have real, anonymised, aggregate data from consenting users; never invent the numbers.

## 3. Cold B2B outreach to US startups with Indian contractors

**Who to target:** US seed-to-Series-B startups that pay 3–50 Indian contractors directly, not through an Employer of Record.

**Where the signals are:**
- LinkedIn job posts saying "contract, remote India".
- Companies whose engineers list "contractor via [startup]" with an India location.
- GitHub organisations with many India-based contributors.

**Who to contact:** the founder/CEO under 30 people; above that, the Head of Finance or Ops, or the controller.

**Pitch:** "Your AP team chases W-8BENs, and you risk withholding 30% from people who shouldn't be withheld on. FormBridge gives each contractor a self-serve W-8BEN and invoice portal, tracks expiry, and tells you exactly who needs a 1042-S."

**Sequence:** 4 touches over 14 days, plain text, no images and no tracking pixels.

1. **Day 0. Subject: "W-8BENs for your India contractors"**
   > Hi {first_name}, noticed {company} works with engineers in India ({signal}). Quick question: who collects and renews their W-8BENs today?
   > Most US startups we talk to either withhold 30% when they shouldn't (and the contractor fights it at tax time), or issue 1099s to non-US people. We built a free checker: {calculator_link}. Happy to show how {company} could get every contractor documented in a day.
   > {name}, FormBridge.ai · {physical_address} · Reply "no" and I won't follow up.
2. **Day 3:** one-line bump plus one fact: "W-8BENs expire on 31 Dec of the third year after signing. Contractors onboarded in 2023 lapse this December."
3. **Day 7:** a short case. Use only real examples from users who have consented.
4. **Day 14:** break-up email. "Should I close the loop?"

**Volume and tools (free tiers):**
- Send 20–30 emails a day from a separate warmed-up domain, such as `getformbridge.com`, with SPF, DKIM and DMARC set up.
- Track replies in a Google Sheet.

**Compliance:**
- CAN-SPAM (US) requires an accurate sender, a non-deceptive subject line, a physical postal address and a working opt-out honoured within 10 business days.
- Do not email EU/UK personal addresses without a lawful basis under GDPR/UK GDPR.

**Offer:** free for contractors; **Agency plan** for the company (all contractors, W-8 tracking, 1042-S readiness list).

## Metrics to watch weekly

| Funnel stage | Target by day 30 |
|---|---|
| Organic visitors to guides | 1,000 |
| Calculator / 1042-S check runs | 300 |
| Sign-ups | 60 |
| Paid (Pro or Agency) | 5 |
| Cold email reply rate | > 5% |
