/**
 * Long-tail SEO guides. Each targets one high-intent query and ends in a tool
 * (calculator, 1042-S check, invoice generator). Facts as verified Oct 2026;
 * re-check every April when forms and LUT years roll over.
 */

export interface Guide {
  slug: string;
  keyword: string;
  title: string;
  description: string;
  answer: string;
  sections: { heading: string; body: string[]; steps?: string[] }[];
  cta: { text: string; href: string; label: string };
  faq: { q: string; a: string }[];
  updated: string;
}

export const GUIDES: Guide[] = [
  {
    slug: "gst-export-invoice-for-us-client",
    keyword: "generate GST export invoice for US client",
    title: "How to make a GST export invoice for a US client (2026)",
    description:
      "What an Indian export-of-services invoice must show under GST Rule 46, how to bill a US client at 0% IGST under LUT, and what US accounts-payable teams expect.",
    answer:
      "Bill in USD with the INR value shown, place of supply \"96-Other Country\", the SAC code, your GSTIN and LUT ARN, and the line \"SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX\". With a valid LUT, IGST is 0%.",
    sections: [
      {
        heading: "When is your work an \"export of services\"?",
        body: [
          "Under section 2(6) of the IGST Act, a supply is an export of services when all five conditions hold: you are in India, the client is outside India, the place of supply is outside India, you are paid in convertible foreign exchange (or INR where RBI allows), and you and the client are not merely two establishments of the same person.",
          "For most B2B services (software, design, consulting) the place of supply is the client's location, so a US client means place of supply outside India. Services tied to immovable property or events in India are exceptions.",
        ],
      },
      {
        heading: "What the invoice must show",
        body: ["GST Rule 46 plus the export-specific items:"],
        steps: [
          "Your legal name, address and GSTIN (if registered).",
          "A serial number of at most 16 characters, unique for the financial year (for example FB/26-27/001).",
          "Invoice date, client's name and full address including country.",
          "Description of services, SAC code (998314 for IT design and development, 998313 for IT consulting).",
          "Amount in USD and the taxable value in INR, with the exchange rate you used.",
          "Place of supply: 96-Other Country.",
          "If exporting under LUT: the declaration \"SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX\" and your LUT ARN.",
        ],
      },
      {
        heading: "What your US client's AP team wants to see",
        body: [
          "US accounts-payable teams reject invoices for missing PO numbers or vendor IDs far more often than for anything tax-related. Add the client's PO number and your vendor ID, a due date matching their terms, and remit-to bank details. Keep a signed W-8BEN on file with them so they do not treat you as a US vendor.",
        ],
      },
      {
        heading: "After you are paid",
        body: [
          "Report each export in GSTR-1 Table 6A, and keep the FIRC or e-BRC from your bank for every receipt. You need these for GST compliance and to reconcile foreign income in your ITR.",
        ],
      },
    ],
    cta: { text: "Create a compliant export invoice in a minute.", href: "/app/invoices/new", label: "Open the invoice generator" },
    faq: [
      {
        q: "Do I charge GST to a US client?",
        a: "No, if the supply qualifies as an export and you have a valid LUT for the year: it is zero-rated at 0% IGST. Without an LUT you pay 18% IGST and claim a refund.",
      },
      {
        q: "I am not GST-registered. What changes?",
        a: "You can still invoice in USD; leave out GSTIN, LUT and the GST declaration. Registration is required once aggregate turnover (including exports) crosses the threshold, ₹20 lakh for services in most states.",
      },
      {
        q: "Which exchange rate should I use for the INR value?",
        a: "Use a consistent, documented rate such as the RBI reference rate or the CBIC-notified rate on the invoice date, and record which one you used.",
      },
    ],
    updated: "2026-10-07",
  },
  {
    slug: "how-to-file-form-67-us-tax-deducted",
    keyword: "how to file Form 67 for US tax deduction",
    title: "How to file Form 67 (and Form 44) for US tax deducted on your income",
    description:
      "Claim credit in India for tax your US client withheld: Form 67 for income up to FY 2025-26, Form 44 from FY 2026-27, the SBI TT rate rule, deadlines and documents.",
    answer:
      "File Form 67 (income up to FY 2025-26) or Form 44 (FY 2026-27 onwards) on the income-tax portal, with the 1042-S or a statement of tax withheld as proof, before the end of the assessment year. The credit is the lower of the US tax and the Indian tax on that income.",
    sections: [
      {
        heading: "Form 67 or Form 44?",
        body: [
          "The Income-tax Act, 2025 took effect on 1 April 2026. For income earned up to FY 2025-26 you still use Form 67 under Rule 128. For income from tax year 2026-27 onwards, the same statement is Form 44 under Rule 76 of the Income-tax Rules, 2026. The substance is largely unchanged.",
        ],
      },
      {
        heading: "Step by step",
        body: [],
        steps: [
          "Split the US tax by deduction date. A 1042-S covers January to December, but Indian years run April to March, so tax withheld in January to March belongs to the previous Indian year.",
          "Convert each deduction at the SBI telegraphic-transfer buying rate on the last day of the month before the month of deduction.",
          "Work out the Indian tax on that same income. Your credit is the lower of the two amounts.",
          "On the income-tax portal, go to e-File → Income Tax Forms → File Income Tax Forms and choose Form 67 (or Form 44).",
          "Enter country (United States), income, tax paid outside India, tax payable in India, the DTAA article and rate, and attach the 1042-S or the client's statement of tax withheld.",
          "Verify the form and then claim the same figures in Schedule FSI and Schedule TR of your ITR.",
        ],
      },
      {
        heading: "Deadline",
        body: [
          "Form 67 can be filed up to the end of the assessment year, provided the ITR itself was filed within the time allowed under section 139(1) or 139(4). For an updated return, file it on or before the date you file that return. Tribunals have repeatedly held the form is procedural, but filing on time avoids the argument.",
        ],
      },
      {
        heading: "Check this first: should the tax have been withheld at all?",
        body: [
          "If you did the work entirely from India, the income is foreign-source for US purposes and nothing should have been withheld. India only credits tax paid in accordance with the treaty, so a credit for wrongly withheld tax is at risk. In that case ask the client to refund it, or claim it back with a US Form 1040-NR.",
        ],
      },
    ],
    cta: { text: "Upload your 1042-S and get the FTC worked out by financial year.", href: "/", label: "Check a 1042-S" },
    faq: [
      {
        q: "Does Form 26AS show the US tax?",
        a: "No. Form 26AS (and Form 168 from tax year 2026-27) only shows Indian TDS/TCS. Foreign tax is claimed only through Form 67/44 and Schedule TR.",
      },
      {
        q: "What proof do I attach?",
        a: "A certificate or statement from the foreign tax authority or the deductor showing the income and tax withheld: for US clients, Form 1042-S, plus proof of payment where available.",
      },
      {
        q: "Can I claim more credit than the Indian tax on the income?",
        a: "No. Excess foreign tax is not refunded or carried forward in India.",
      },
    ],
    updated: "2026-10-07",
  },
  {
    slug: "w8ben-for-indian-freelancers",
    keyword: "W-8BEN form for Indian freelancers",
    title: "W-8BEN for Indian freelancers: fill it once, stop the 30% withholding",
    description:
      "Which W-8 form an Indian freelancer or agency gives a US client, how to fill W-8BEN line by line, when Part II (treaty) applies, and when it expires.",
    answer:
      "Individuals give the client Form W-8BEN; companies and LLPs give W-8BEN-E. For work done entirely in India you usually only need Part I and the signature. It stays valid until 31 December of the third year after you sign it.",
    sections: [
      {
        heading: "Which form?",
        body: [
          "W-8BEN: individuals and sole proprietors. W-8BEN-E: entities such as private limited companies and LLPs. Form 8233: individuals claiming a treaty exemption for services physically performed in the US. Never fill a W-9; that is for US persons.",
        ],
      },
      {
        heading: "Filling W-8BEN line by line",
        body: [],
        steps: [
          "Line 1: your name as on your PAN.",
          "Line 2: country of citizenship, India.",
          "Line 3: permanent residence address in India (no PO box or care-of address).",
          "Line 5: US taxpayer ID, leave blank unless you have one.",
          "Line 6a: foreign tax identifying number, your PAN.",
          "Line 8: date of birth.",
          "Part II (lines 9–10): only if you are claiming a reduced rate on US-source income, for example 15% on royalties under Article 12. For services performed from India, it is usually not needed.",
          "Part III: sign, date and print your name.",
        ],
      },
      {
        heading: "Renewing",
        body: [
          "A W-8BEN signed in February 2026 expires on 31 December 2029. Send a fresh one before then, and immediately if your details change (for example you move abroad).",
        ],
      },
    ],
    cta: { text: "Find out what your client should withhold and which form to send.", href: "/calculator", label: "Open the DTAA calculator" },
    faq: [
      {
        q: "My client sent me a W-9. What do I do?",
        a: "Reply with a W-8BEN (or W-8BEN-E) instead. A W-9 certifies you are a US person, which you are not.",
      },
      {
        q: "Do I need a US ITIN?",
        a: "Not for services performed from India. Your PAN on line 6a is enough in most cases.",
      },
    ],
    updated: "2026-10-07",
  },
  {
    slug: "us-client-withheld-30-percent-tax",
    keyword: "US client deducted 30% tax Indian freelancer",
    title: "Your US client withheld 30% tax. Here is how to get it back",
    description:
      "Why a US client withholds 30% (or 24% backup withholding) from an Indian freelancer, how to stop it, and whether to claim a US refund or an Indian foreign tax credit.",
    answer:
      "It usually means the client had no valid W-8BEN, or treated your remote work as US-source. Send a W-8BEN now, ask the client to correct and refund what they can, and otherwise file Form 1040-NR. Only tax that was correctly withheld under the treaty belongs in an Indian Form 67/44 claim.",
    sections: [
      {
        heading: "Why it happens",
        body: [
          "30% is the US statutory rate on US-source income paid to foreign persons without documentation. 24% backup withholding happens when the client treats you as a US person (you will see a 1099 instead of a 1042-S). Work you do while physically in India is foreign-source income, so neither should apply once the client has your W-8BEN.",
        ],
      },
      {
        heading: "What to do",
        body: [],
        steps: [
          "Send the client a signed W-8BEN (individuals) or W-8BEN-E (entities) today, so future payments are paid in full.",
          "Ask the client whether they can still adjust the over-withholding for this calendar year. Withholding agents can sometimes repay it before filing their returns.",
          "Get the Form 1042-S (or 1099) after the year ends.",
          "If the client cannot fix it, file US Form 1040-NR to claim the refund. If part of the tax was correct (for example 15% on royalties), claim that part as foreign tax credit in India.",
        ],
      },
    ],
    cta: { text: "Upload the 1042-S and see what was withheld wrongly.", href: "/", label: "Check a 1042-S" },
    faq: [
      {
        q: "Can I just claim the 30% as credit in India instead?",
        a: "Risky. India allows credit only for tax paid in accordance with the DTAA, and the credit is capped at the Indian tax on that income. Wrongly withheld tax is better recovered from the US.",
      },
    ],
    updated: "2026-10-07",
  },
  {
    slug: "lut-for-export-of-services-2026-27",
    keyword: "LUT for export of services GST 2026-27",
    title: "How to file LUT (RFD-11) for export of services for FY 2026-27",
    description:
      "File your GST Letter of Undertaking for FY 2026-27 so you can invoice foreign clients at 0% IGST: steps on the GST portal, who needs it and what to put on invoices.",
    answer:
      "On the GST portal go to Services → User Services → Furnish Letter of Undertaking (LUT), choose FY 2026-27, complete the declaration with two witnesses, and sign with DSC or EVC. Put the ARN on every export invoice. You need a new LUT every financial year.",
    sections: [
      {
        heading: "Steps",
        body: [],
        steps: [
          "Log in to gst.gov.in.",
          "Services → User Services → Furnish Letter of Undertaking (LUT).",
          "Select financial year 2026-27.",
          "Tick the declarations, add two independent witnesses (name, address, occupation).",
          "Sign with DSC or EVC and submit. Download the acknowledgement with the ARN.",
          "Quote the ARN and the LUT declaration on every export invoice dated in FY 2026-27.",
        ],
      },
      {
        heading: "Timing",
        body: [
          "File before your first export invoice of the year. An invoice issued on 2 April without a current LUT technically needs IGST paid, so file in the first days of April each year.",
        ],
      },
    ],
    cta: { text: "Record your LUT once; every invoice picks it up automatically.", href: "/app/settings", label: "Add your LUT" },
    faq: [
      {
        q: "Is LUT mandatory for freelancers?",
        a: "Only if you are GST-registered and want to export without paying IGST. Without it, you pay 18% IGST and claim a refund later.",
      },
      {
        q: "Does it cost anything?",
        a: "No. Filing RFD-11 on the portal is free.",
      },
    ],
    updated: "2026-10-07",
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
