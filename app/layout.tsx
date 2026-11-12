import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import { Scale } from "lucide-react";
import "./globals.css";

const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const SITE_NAME = "LegalPrep";
const DESCRIPTION =
  "A virtual courtroom with a digital judge. Practise your delivery, get feedback on pace and clarity, and build composure. Familiarisation only, never legal advice.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: `${SITE_NAME} | Familiarise yourself with a hearing`, template: `%s | ${SITE_NAME}` },
  description: DESCRIPTION,
  openGraph: {
    title: `${SITE_NAME} | Familiarise yourself with a hearing`,
    description: DESCRIPTION,
    type: "website",
    locale: "en_GB",
    siteName: SITE_NAME,
  },
  twitter: { card: "summary", title: SITE_NAME, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#0b1018" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brass-400 focus:px-3 focus:py-2 focus:text-ink-950"
        >
          Skip to content
        </a>
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 print:hidden">
          <Link href="/" className="flex items-center gap-2.5" aria-label="LegalPrep home">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brass-400/15 text-brass-400">
              <Scale className="h-5 w-5" aria-hidden />
            </span>
            <span className="font-serif text-lg tracking-tight">LegalPrep</span>
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-5 text-sm text-parchment-200">
            <Link href="/tour" className="hover:text-parchment-50">Tour</Link>
            <Link href="/privacy" className="hover:text-parchment-50">Privacy</Link>
            <Link
              href="/prep"
              className="rounded-lg bg-brass-400 px-4 py-2 font-medium text-ink-950 hover:bg-brass-300"
            >
              Prep Room
            </Link>
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-5 pb-16">
          {children}
        </main>
        <footer className="border-t border-ink-700 print:hidden">
          <div className="mx-auto max-w-6xl px-5 py-8 text-xs leading-relaxed text-parchment-400">
            LegalPrep is a familiarisation tool for hearings in England &amp; Wales. It is not a law firm and
            nothing here is legal advice. This is a demonstration build: nothing you enter is stored.
          </div>
        </footer>
      </body>
    </html>
  );
}
