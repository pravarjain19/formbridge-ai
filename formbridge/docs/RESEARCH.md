# FormBridge.ai: US–India compliance research (verified October 2026)

> Product research, not tax advice. Have a Chartered Accountant (CA) and a US Enrolled Agent (EA) or CPA review the rule tables before launch, and re-verify them every year.

## 1. Regime changes that drive the product

| Area | Up to FY 2025-26 (AY 2026-27) | Tax year 2026-27 onward (from 1 Apr 2026) |
|---|---|---|
| Governing law | Income-tax Act, 1961 | Income-tax Act, 2025 ("previous year" becomes "tax year") |
| FTC statement | **Form 67**, Rule 128 | **Form 44**, Rule 76 of the Income-tax Rules, 2026 (substance largely unchanged) |
| Annual tax credit statement | Form 26AS + AIS | **Form 168** (Sec. 510 / Rule 245), which merges 26AS and AIS |
| GST LUT | RFD-11, per FY | A fresh RFD-11 LUT is needed for FY 2026-27 before the first export of the year (the portal accepts it) |

**Consequence:** every user filing in 2026–27 deals with both regimes at once. They file Form 67 for FY 2025-26 income and track Form 44 for FY 2026-27 income. The schema stores the regime per row (`ftc_form_for_fy()`), so the product does not need two code paths.

## 2. The largest compliance gap: most of these users should have no US withholding

- An Indian contractor who does the work **entirely outside the US** earns **foreign-source** income (IRC §862(a)(3)). If they give the client a valid W-8BEN (individuals) or W-8BEN-E (entities), the client should withhold nothing, issue no 1099, and usually file no 1042-S.
- US clients often get this wrong in one of three ways:
  - They issue a **1099-NEC**, which treats the contractor as a US person.
  - They apply **24% backup withholding**.
  - They withhold **30% on a 1042-S** under income code 17.
- India allows FTC only for foreign tax paid **in accordance with the DTAA**. Tax wrongly withheld on foreign-source services is therefore at risk of FTC denial. The right fix is a refund through the withholding agent or Form 1040-NR, not a Form 67/44 claim.
- **Product angle:** the most valuable thing FormBridge can do is *prevent* the withholding. It should track W-8BEN validity per client and flag any 1099 or 1042-S that should not exist. FTC filing is the fallback path.
- A W-8BEN stays valid until 31 Dec of the third calendar year after signing. Example: signed in Feb 2026, it expires 31 Dec 2029. The schema computes this as a generated column.

**When US tax is legitimately in play**, the reconciler has real work to do:
- Services physically performed in the US. Under India–US DTAA Art. 15, independent personal services become taxable in the US if the person has a fixed base there or is present there 90+ days in the year. Art. 15 is a lower threshold than the generic 183-day rule; confirm it against the treaty text in the IRS link below.
- Royalties and fees for included services under DTAA Art. 12: 15% generally, 10% for some equipment royalties. FIS needs the "make available" test.
- Agencies and entities that use W-8BEN-E.

## 3. Fields to cross-reconcile: US slips against Indian records

| US source | Field | Indian counterpart | Notes |
|---|---|---|---|
| 1042-S Box 1 | Income code (17 = indep. personal services) | ITR Schedule FSI income head | Decides which DTAA article applies |
| 1042-S Box 2 | Gross income (USD) | ITR Schedule FSI; invoice totals; FIRC/e-BRC realisations | Gross must reconcile with invoices for the US calendar year, while India uses Apr–Mar. The reconciler must split by date |
| 1042-S Box 3/3a/3b | Chapter, exemption code (04 = treaty), rate | DTAA rate cap in Form 67/44 | A 30% rate with exemption 00 means no treaty claim was made |
| 1042-S Box 7a / Box 10 | Federal tax withheld / total credit | **Form 67 / 44**: foreign tax paid; **ITR Schedule TR** | Convert at the **SBI TT buying rate on the last day of the month before the month of deduction** (Rule 128 / Rule 76) |
| 1042-S Box 12a/12d | Withholding agent EIN and name | Client master; FIRC remitter name | Entity match |
| 1042-S Box 13b/13i | Recipient country (IN), foreign TIN (PAN) | PAN on Form 67/44 and the ITR | A mismatched PAN breaks the claim |
| 1042-S UFI | Unique form identifier | Supporting-doc reference for Form 67/44 | Dedupe and amendment tracking |
| Remittance advice | Payment date, gross, tax, fees, net | Bank credit / FIRC / e-BRC; AIS/Form 168 SFT data on foreign inward remittances | Payment date sets the Indian FY and the TT-rate month |
| Invoice | Number, date, USD value, INR value, LUT ARN | GSTR-1 Table 6A (exports); GSTR-3B 3.1(b) | The INR value of each export is what reaches GST returns |

**Key fact:** Form 26AS / Form 168 never shows US tax; it only shows Indian TDS/TCS. "Reconciliation" in this product means matching:
1. US slip ↔ remittance ↔ bank/FIRC, which sets the gross and the date.
2. That chain ↔ the invoice ledger, which feeds GSTR-1.
3. That chain ↔ the Form 67/44 and Schedule FSI/TR figures.
4. AIS/Form 168 entries for foreign inward remittances, as a cross-check that the income was reported.

## 4. GST: zero-rated export of services

Five conditions must all hold (IGST Act §2(6)):
1. The supplier is in India.
2. The recipient is outside India.
3. The place of supply is outside India. Default B2B rule: the recipient's location, with exceptions such as immovable property and events.
4. Payment arrives in convertible foreign exchange, or in INR where RBI permits.
5. The two parties are not merely establishments of the same entity.

Invoice must-haves that the invoice generator enforces:
- An invoice number of at most 16 characters, unique per FY (Rule 46).
- The recipient's name and address with the country.
- An SAC code. Place of supply "96-Other Country".
- The value in USD with the INR equivalent.
- The endorsement **"SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX"** and the LUT ARN.

Report exports in GSTR-1 Table 6A, due on the 11th (monthly filers) or the 13th after the quarter (QRMP). The LUT lasts one FY, so the app must block LUT invoices dated after 31 Mar until the new ARN is entered. The schema enforces this with a `lut_requires_ref` check plus the FY on the LUT row.

## 5. Gaps that existing tools leave open

1. Nobody tracks **W-8BEN expiry per client** for the payee side. Payroll and AP tools (Deel, Tipalti) only track it for the payer.
2. No tool flags **wrongful US withholding** (1099 or 30%) **before** the user tries to claim FTC in India.
3. No tool covers the **Form 67 → Form 44 / 26AS → Form 168 transition**. Users face both regimes in the 2026-27 filing season.
4. **Calendar year vs Apr–Mar split:** a single 1042-S covers Jan–Dec, but FTC is claimed per Indian FY. Users split it by hand today.
5. **Dual-currency invoices** that satisfy both GST Rule 46 and US AP vendor requirements (PO number, vendor ID, W-8 reference) are rare in Indian invoicing tools.

## Sources

- [Form 67 → Form 44 transition (vested.blog)](https://vested.blog/posts/form-67-form-44-transition-ay-2026-27)
- [Form 67 / Rule 128 due-date amendment (Skydo)](https://www.skydo.com/blog/foreign-tax-credit-form-67)
- [Form 67 guide (ClearTax)](https://cleartax.in/s/form-67-claim-foreign-tax-credit)
- [Form 168 replaces Form 26AS (TaxHeal)](https://www.taxheal.com/?p=121461)
- [Form 26AS is now Form 168](https://indianpaycalculator.in/form-168-form-26as)
- [1099 vs 1042-S for foreign contractors (Tipalti)](https://tipalti.com/blog/1099-for-foreign-contractors/)
- [1042-S vs 1099 classification (1099fire)](https://1099fire.com/blog/form-1042-s-vs-1099-correctly-classifying-payments-to-foreign-contractors/)
- [Form 1042-S instructions summary (TaxBandits)](https://www.taxbandits.com/1042-forms/form-1042-s-instructions/)
- [1042-S income code 17 (Reed Corp)](https://reedcorp.tax/helpful-guides/form-1042-s-code-17-eci-reporting/)
- [US–India treaty technical explanation (IRS)](https://www.stayexempt.irs.gov/pub/irs-trty/inditech.pdf)
- [India–US DTAA Art. 12 FIS analysis (BCAJ)](https://bcajonline.org/journal/article-12-of-indo-us-dtaa-co-ordination-fees-business-profits-under-dtaa-no-pe-and-hence-not-chargeable-to-tax-creative-fees-and-database-costs-chargeable-as-they-are-not-royalt/)
- [GST LUT for FY 2026-27 (TaxAJ)](https://www.taxaj.com/learn/?p=717)
- [GSTN enables LUT for FY 2026-27](https://taxonation.com/show-detail-news/2911104/gstns-important-update-furnishing-of-letter-of-undertaking-lut-for-fy-202627-enabled-on-gst-portal)
- [Export of services under GST (Skydo)](https://www.skydo.com/blog/export-of-services-under-gst)
- [GST export rules for freelancers (IncorpX)](https://www.incorpx.io/blog/gst-export-of-services-freelancers-india)
