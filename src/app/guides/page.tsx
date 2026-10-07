import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/content/guides";

export const metadata: Metadata = {
  title: "US–India tax & invoicing guides for freelancers | FormBridge.ai",
  description: "Plain-English guides on GST export invoices, W-8BEN, LUT, US withholding and Form 67 / Form 44 for Indians working with US clients.",
  alternates: { canonical: "/guides" },
};

export default function GuidesIndex() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Guides</h1>
      <p className="mt-2 text-slate-600">For Indian freelancers, contractors and agencies billing US clients.</p>
      <ul className="mt-8 space-y-6">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`} className="text-lg font-semibold underline">
              {g.title}
            </Link>
            <p className="mt-1 text-sm text-slate-600">{g.description}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
