/**
 * US–India DTAA withholding estimator for an Indian resident paid by a US client.
 *
 * Simplified on purpose: it answers "should any US tax be withheld, at what
 * rate, on which form, and what Indian FTC does that imply?" It is an estimate
 * for planning, not advice; edge cases (US permanent establishment, dual
 * residency, LOB tests) are flagged for professional review rather than modelled.
 *
 * Treaty references: India–US DTAA (1989) Art. 7 business profits, Art. 12
 * royalties / fees for included services, Art. 15 independent personal services
 * (taxable in the US only with a fixed base there or 90+ days' presence).
 */

export type PayeeType = "individual" | "entity";
export type IncomeType = "services" | "royalty" | "fis";

export interface DtaaInput {
  payeeType: PayeeType;
  incomeType: IncomeType;
  /** Annual amount billed to the US client, USD. */
  amountUsd: number;
  /** Share of the work physically performed inside the US, 0–100. */
  usWorkSharePct: number;
  /** Days physically present in the US during the year. */
  daysInUs: number;
  /** Fixed base (individual) or permanent establishment (entity) in the US. */
  usFixedBaseOrPe: boolean;
  /** A valid W-8BEN / W-8BEN-E (or 8233) has been given to the client. */
  w8OnFile: boolean;
  /** Your expected marginal Indian tax rate incl. surcharge/cess, %. */
  indianTaxRatePct: number;
  /** SBI TT buying rate used for FTC conversion, INR per USD. */
  sbiTtRate: number;
}

export type Severity = "ok" | "warning" | "review";

export interface DtaaResult {
  usSourceUsd: number;
  foreignSourceUsd: number;
  correctUsRatePct: number;
  correctUsTaxUsd: number;
  /** What an un-documented client typically withholds instead. */
  riskUsTaxUsd: number;
  formToGiveClient: "W-8BEN" | "W-8BEN-E" | "Form 8233 + W-8BEN" | "W-8ECI (review)";
  expectedUsReporting: string;
  treatyArticle: string;
  ftcInr: number;
  indianTaxOnUsIncomeInr: number;
  notes: { severity: Severity; text: string }[];
}

const STATUTORY_RATE = 30;
const ROYALTY_FIS_TREATY_RATE = 15;
const ART15_DAY_THRESHOLD = 90;

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 0));

export function estimateDtaa(raw: DtaaInput): DtaaResult {
  const input: DtaaInput = {
    ...raw,
    amountUsd: Math.max(0, raw.amountUsd || 0),
    usWorkSharePct: clamp(raw.usWorkSharePct, 0, 100),
    daysInUs: clamp(raw.daysInUs, 0, 366),
    indianTaxRatePct: clamp(raw.indianTaxRatePct, 0, 50),
    sbiTtRate: Math.max(0, raw.sbiTtRate || 0),
  };
  const notes: DtaaResult["notes"] = [];
  const w8Form = input.payeeType === "individual" ? "W-8BEN" : "W-8BEN-E";

  let usSourceUsd: number;
  let ratePct: number;
  let formToGiveClient: DtaaResult["formToGiveClient"] = w8Form;
  let expectedUsReporting: string;
  let treatyArticle: string;

  if (input.incomeType === "services") {
    // Services are sourced where performed (IRC 861(a)(3) / 862(a)(3)).
    usSourceUsd = (input.amountUsd * input.usWorkSharePct) / 100;

    if (input.payeeType === "individual") {
      treatyArticle = "Art. 15 (independent personal services)";
      const taxableInUs = input.usFixedBaseOrPe || input.daysInUs >= ART15_DAY_THRESHOLD;
      if (usSourceUsd === 0) {
        ratePct = 0;
        expectedUsReporting = "None: no 1099 and normally no 1042-S (foreign-source income).";
      } else if (taxableInUs) {
        ratePct = STATUTORY_RATE;
        expectedUsReporting = "Form 1042-S, income code 17, on the US-performed portion.";
        notes.push({
          severity: "review",
          text: `You have a US fixed base or ${ART15_DAY_THRESHOLD}+ days in the US, so Art. 15 lets the US tax the US-performed work. You would file Form 1040-NR; get a US tax professional involved.`,
        });
      } else {
        ratePct = 0;
        formToGiveClient = "Form 8233 + W-8BEN";
        expectedUsReporting = "Form 1042-S, income code 17, exemption code 04 (treaty), on the US-performed portion.";
        notes.push({
          severity: "warning",
          text: "Part of the work was done in the US. The treaty exempts it (under 90 days, no fixed base), but you must give the client Form 8233 each year to claim it, or it will be withheld at 30%.",
        });
      }
    } else {
      treatyArticle = "Art. 7 (business profits)";
      if (input.usFixedBaseOrPe && usSourceUsd > 0) {
        ratePct = 0;
        formToGiveClient = "W-8ECI (review)";
        expectedUsReporting = "Effectively connected income: US return required.";
        notes.push({
          severity: "review",
          text: "A US permanent establishment makes the profit attributable to it taxable in the US. This is outside what the calculator models; get professional advice.",
        });
      } else {
        ratePct = 0;
        expectedUsReporting =
          usSourceUsd > 0
            ? "Form 1042-S may be issued for the US-performed portion with a treaty (Art. 7) exemption."
            : "None: foreign-source income.";
      }
    }
  } else {
    // Royalties and FIS are sourced where the right/service is used: a US client => US-source.
    usSourceUsd = input.amountUsd;
    ratePct = ROYALTY_FIS_TREATY_RATE;
    treatyArticle = input.incomeType === "royalty" ? "Art. 12 (royalties)" : "Art. 12 (fees for included services)";
    expectedUsReporting = "Form 1042-S (royalty/FIS income code), chapter 3 rate 15%, exemption code 04 for the treaty reduction.";
    if (input.incomeType === "fis") {
      notes.push({
        severity: "warning",
        text: "Art. 12 only covers technical services that 'make available' knowledge or skills the client can use on its own. Ordinary development or consulting usually is not FIS; it falls under Art. 7/15 and is exempt. Check before accepting 15% withholding.",
      });
    }
  }

  const correctUsTaxUsd = round2((usSourceUsd * ratePct) / 100);

  // What tends to happen without paperwork: 30% on anything the client treats as US-source,
  // or 24% backup withholding when the client wrongly treats you as a US person.
  let riskUsTaxUsd = correctUsTaxUsd;
  if (!input.w8OnFile) {
    const exposedUsd = input.incomeType === "services" ? input.amountUsd : usSourceUsd;
    riskUsTaxUsd = round2((exposedUsd * STATUTORY_RATE) / 100);
    notes.push({
      severity: "warning",
      text: `Without a ${formToGiveClient.replace(" (review)", "")} on file, US clients often withhold 30% (or 24% backup withholding via a 1099), up to USD ${riskUsTaxUsd.toLocaleString("en-US")} a year. Getting that back means filing a US return.`,
    });
  }

  const usIncomeInr = usSourceUsd * input.sbiTtRate;
  const indianTaxOnUsIncomeInr = round2((usIncomeInr * input.indianTaxRatePct) / 100);
  const foreignTaxInr = correctUsTaxUsd * input.sbiTtRate;
  const ftcInr = round2(Math.min(foreignTaxInr, indianTaxOnUsIncomeInr));

  if (correctUsTaxUsd > 0 && foreignTaxInr > indianTaxOnUsIncomeInr) {
    notes.push({
      severity: "warning",
      text: "US tax exceeds the Indian tax on the same income; the excess is not creditable in India.",
    });
  }
  if (correctUsTaxUsd > 0) {
    notes.push({
      severity: "ok",
      text: "Claim the credit in India with Form 67 (income up to FY 2025-26) or Form 44 (FY 2026-27 onwards), filed with your ITR, plus the 1042-S as proof. Convert at the SBI TT buying rate on the last day of the month before the tax was deducted.",
    });
  } else if (input.incomeType === "services" && usSourceUsd === 0) {
    notes.push({
      severity: "ok",
      text: `No US tax should be withheld. Give the client a ${w8Form}, renew it every 3 calendar years, and invoice as an export of services under LUT (zero-rated GST).`,
    });
  }

  return {
    usSourceUsd: round2(usSourceUsd),
    foreignSourceUsd: round2(input.amountUsd - usSourceUsd),
    correctUsRatePct: ratePct,
    correctUsTaxUsd,
    riskUsTaxUsd,
    formToGiveClient,
    expectedUsReporting,
    treatyArticle,
    ftcInr,
    indianTaxOnUsIncomeInr,
    notes,
  };
}
