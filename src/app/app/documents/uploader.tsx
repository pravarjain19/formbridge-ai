"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buttonCls, Field, inputCls } from "../ui";

const ACCEPT = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 20 * 1024 * 1024;

async function sha256Hex(buf: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Uploads straight from the browser to Storage (RLS: own folder only), records
 * the `documents` row, then asks the server to run OCR on it.
 */
export function Uploader({ clients }: { clients: { id: string; legal_name: string }[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file") as File | null;
    setError(null);
    if (!file || !file.size) return setError("Choose a file");
    if (!ACCEPT.includes(file.type)) return setError("Only PDF, PNG, JPG or WebP files are supported");
    if (file.size > MAX_BYTES) return setError("File is larger than 20 MB");

    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setError("Your session expired; sign in again");

    try {
      setStatus("Uploading…");
      const bytes = await file.arrayBuffer();
      const id = crypto.randomUUID();
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120);
      const path = `${auth.user.id}/${id}/${safeName}`;

      const up = await supabase.storage.from("tax-documents").upload(path, file, { contentType: file.type });
      if (up.error) throw new Error(up.error.message);

      const ins = await supabase.from("documents").insert({
        id,
        user_id: auth.user.id,
        client_id: (fd.get("client_id") as string) || null,
        doc_type: (fd.get("doc_type") as string) || "other",
        storage_path: path,
        original_name: file.name.slice(0, 255),
        mime_type: file.type,
        size_bytes: file.size,
        sha256: await sha256Hex(bytes),
      });
      if (ins.error) {
        await supabase.storage.from("tax-documents").remove([path]);
        throw new Error(ins.error.code === "23505" ? "You already uploaded this exact file" : ins.error.message);
      }

      setStatus("Reading the document…");
      const res = await fetch(`/api/documents/${id}/parse`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Uploaded, but reading failed: ${body.error ?? res.status}`);

      form.reset();
      setStatus(body.status === "parsed" ? "Done: no problems found." : "Done: needs your review (see below).");
      router.refresh();
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : String(err));
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
      <Field label="File (PDF/PNG/JPG, max 20 MB)">
        <input name="file" type="file" accept={ACCEPT.join(",")} required className="mt-1 block w-full text-sm" />
      </Field>
      <Field label="Type">
        <select name="doc_type" className={inputCls}>
          <option value="">Detect automatically</option>
          <option value="form_1042s">Form 1042-S</option>
          <option value="form_1099_nec">Form 1099-NEC</option>
          <option value="remittance_advice">Remittance advice</option>
          <option value="firc">FIRC</option>
        </select>
      </Field>
      <Field label="Client (optional)">
        <select name="client_id" className={inputCls}>
          <option value="">—</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.legal_name}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-3">
        <button disabled={status === "Uploading…" || status === "Reading the document…"} className={buttonCls}>
          Upload and check
        </button>
        {status && <span className="ml-3 text-sm text-slate-600">{status}</span>}
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
    </form>
  );
}
