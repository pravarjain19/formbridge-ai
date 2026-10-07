import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FormBridge.ai",
  description: "US–India cross-border tax compliance for Indian freelancers, contractors and agencies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
