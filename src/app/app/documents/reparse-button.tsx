"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Re-run OCR on a stored document (e.g. after hitting the monthly limit or an upstream error). */
export function ReparseButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/documents/${documentId}/parse`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 402) setMsg(`Monthly limit of ${body.limit} reached`);
    else if (!res.ok) setMsg(`Failed: ${body.error ?? res.status}`);
    router.refresh();
  }

  return (
    <span className="ml-2 text-sm">
      <button onClick={run} disabled={busy} className="underline disabled:opacity-50">
        {busy ? "Checking…" : "Check now"}
      </button>
      {msg && <span className="ml-2 text-red-700">{msg}</span>}
    </span>
  );
}
