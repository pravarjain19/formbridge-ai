import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white print:hidden">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
        <Link href="/" className="text-base font-bold">
          FormBridge.ai
        </Link>
        <Link href="/calculator" className="text-slate-600 hover:text-slate-900">
          DTAA calculator
        </Link>
        <Link href="/" className="text-slate-600 hover:text-slate-900">
          Check a 1042-S
        </Link>
        <Link href="/app" className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white">
          Dashboard
        </Link>
      </nav>
    </header>
  );
}
