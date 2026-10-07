import { requireUser } from "@/lib/supabase/server";
import type { ValidationIssue } from "@/lib/ocr/validate";
import { Badge, Card, PageTitle } from "../ui";
import { Uploader } from "./uploader";

const TONE = {
  uploaded: "slate",
  processing: "amber",
  parsed: "green",
  needs_review: "amber",
  verified: "green",
  failed: "red",
} as const;

const ISSUE_STYLE = {
  error: "text-red-800",
  warning: "text-amber-800",
  info: "text-slate-600",
} as const;

export default async function DocumentsPage() {
  const { supabase } = await requireUser();
  const [{ data: clients }, { data: docs }] = await Promise.all([
    supabase.from("clients").select("id, legal_name").order("legal_name"),
    supabase
      .from("documents")
      .select("id, original_name, doc_type, status, tax_year, created_at, storage_path, clients(legal_name), ocr_runs!documents_latest_ocr_fk(status, model, validation_issues, overall_confidence)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  // Short-lived links so files can be opened without making the bucket public.
  const signed = docs?.length
    ? (await supabase.storage.from("tax-documents").createSignedUrls(docs.map((d) => d.storage_path), 600)).data ?? []
    : [];
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]));

  return (
    <>
      <PageTitle title="Documents" />
      <Card>
        <p className="mb-4 text-sm text-slate-600">
          Upload US tax slips (1042-S, 1099) and client remittance advices. FormBridge reads them and checks the US
          withholding before you claim credit in India.
        </p>
        <Uploader clients={clients ?? []} />
      </Card>

      <div className="mt-6 space-y-3">
        {(docs ?? []).map((d) => {
          const run = d.ocr_runs as unknown as {
            status: string;
            model: string;
            validation_issues: ValidationIssue[];
            overall_confidence: number | null;
          } | null;
          const issues = run?.validation_issues ?? [];
          return (
            <Card key={d.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <a href={urlFor.get(d.storage_path) ?? "#"} target="_blank" rel="noreferrer" className="font-medium underline">
                    {d.original_name}
                  </a>
                  <p className="text-xs text-slate-500">
                    {d.doc_type.replace(/_/g, " ")}
                    {d.tax_year && ` · ${d.tax_year}`}
                    {(d.clients as unknown as { legal_name: string } | null)?.legal_name &&
                      ` · ${(d.clients as unknown as { legal_name: string }).legal_name}`}
                    {run && ` · read by ${run.model}`}
                    {run?.overall_confidence != null && ` · ${(run.overall_confidence * 100).toFixed(0)}% confidence`}
                  </p>
                </div>
                <Badge tone={TONE[d.status as keyof typeof TONE]}>{d.status.replace("_", " ")}</Badge>
              </div>
              {issues.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {issues.map((i, n) => (
                    <li key={n} className={ISSUE_STYLE[i.severity]}>
                      <b className="uppercase">{i.severity}</b> · {i.message}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
        {!docs?.length && <p className="text-sm text-slate-500">No documents yet.</p>}
      </div>
    </>
  );
}
