import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, guideBySlug } from "@/content/guides";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  return {
    title: `${g.title} | FormBridge.ai`,
    description: g.description,
    alternates: { canonical: `/guides/${g.slug}` },
    openGraph: { title: g.title, description: g.description, type: "article" },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: g.title, description: g.description, dateModified: g.updated },
      {
        "@type": "FAQPage",
        mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="text-sm text-slate-500">
        <Link href="/guides" className="underline">
          Guides
        </Link>{" "}
        · Updated {g.updated}
      </p>
      <h1 className="mt-2 text-3xl font-bold leading-tight">{g.title}</h1>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold uppercase text-slate-500">Short answer</p>
        <p className="mt-1">{g.answer}</p>
      </div>

      {g.sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="text-xl font-semibold">{s.heading}</h2>
          {s.body.map((p, i) => (
            <p key={i} className="mt-3 leading-relaxed text-slate-700">
              {p}
            </p>
          ))}
          {s.steps && (
            <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-700">
              {s.steps.map((st, i) => (
                <li key={i}>{st}</li>
              ))}
            </ol>
          )}
        </section>
      ))}

      <div className="mt-10 rounded-xl bg-slate-900 p-6 text-white">
        <p className="text-lg font-semibold">{g.cta.text}</p>
        <Link href={g.cta.href} className="mt-3 inline-block rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900">
          {g.cta.label} →
        </Link>
        <p className="mt-2 text-xs text-slate-300">Free to start. No card needed.</p>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">FAQ</h2>
        {g.faq.map((f) => (
          <details key={f.q} className="mt-3 rounded-md border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer font-medium">{f.q}</summary>
            <p className="mt-2 text-slate-700">{f.a}</p>
          </details>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Related guides</h2>
        <ul className="mt-2 list-disc pl-6">
          {GUIDES.filter((o) => o.slug !== g.slug).map((o) => (
            <li key={o.slug}>
              <Link href={`/guides/${o.slug}`} className="underline">
                {o.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-xs text-slate-500">General information, not tax advice. Rules verified {g.updated}; confirm with a CA for your situation.</p>
    </main>
  );
}
