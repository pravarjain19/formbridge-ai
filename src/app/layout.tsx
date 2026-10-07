import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "./site-header";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://formbridge.ai"),
  title: "FormBridge.ai",
  description: "US–India cross-border tax compliance for Indian freelancers, contractors and agencies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
