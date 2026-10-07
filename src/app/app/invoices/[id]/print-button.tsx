"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium">
      Print / save as PDF
    </button>
  );
}
