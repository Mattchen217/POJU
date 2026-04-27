import Link from "next/link";
import type { Metadata } from "next";

import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { MarketingLocaleProvider } from "@/components/marketing/marketing-locale";
import { PojuMarkLogo } from "@/components/marketing/poju-mark-logo";

export const metadata: Metadata = {
  title: "Disclaimer — POJU",
  description: "POJU disclaimer",
};

export default function DisclaimerPage() {
  return (
    <MarketingLocaleProvider>
      <main className="bg-bg-deep text-text-body">
        <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
          <header className="px-1 py-2.5 sm:py-3 md:px-2">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
              <Link href="/" className="inline-flex items-center gap-0">
                <PojuMarkLogo />
                <span className="inline-flex items-center text-[14px] font-semibold leading-none tracking-[0.09em] text-text-primary sm:text-[15px] md:text-[16px]">
                  POJU
                </span>
              </Link>
              <nav className="hidden items-center gap-7 text-[12px] uppercase tracking-[0.12em] text-text-secondary sm:text-[13px] md:flex md:text-[14px]">
                <Link href="/poju" className="hover:text-text-primary">
                  POJU 破局
                </Link>
                <Link href="/syncro" className="hover:text-text-primary">
                  POJU SYNCRO
                </Link>
                <Link href="/oracle" className="hover:text-text-primary">
                  POJU ORACLE
                </Link>
                <Link href="/archive" className="hover:text-text-primary">
                  THE ARCHIVE
                </Link>
              </nav>
              <MarketingLanguageSwitcher />
            </div>
          </header>

          <section className="mx-auto mt-2 w-full max-w-6xl">
            <div className="h-[calc(100vh-220px)] min-h-[820px] w-full overflow-hidden rounded-xl border border-white/10 bg-black/60">
              <iframe title="Disclaimer UI" src="/disclaimer-ui.html" className="h-full w-full border-0" />
            </div>
          </section>

          <footer className="mt-8 w-full rounded-xl bg-bg-layer-1/60 px-4 py-6 md:px-8">
            <div className="mx-auto max-w-6xl text-center">
              <p className="text-lg font-semibold tracking-[0.12em] text-text-primary">POJU</p>
              <p className="mt-1 text-sm text-text-secondary">pojulife.com</p>
              <div className="my-4 h-px bg-gradient-to-r from-transparent via-glass-border to-transparent" />
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-text-secondary">
                <Link href="/" className="hover:text-text-primary">
                  Home
                </Link>
                <Link href="/disclaimer" className="hover:text-text-primary">
                  Disclaimer
                </Link>
                <Link href="/privacy" className="hover:text-text-primary">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="hover:text-text-primary">
                  Terms of Service
                </Link>
                <Link href="/contact" className="hover:text-text-primary">
                  Contact
                </Link>
              </div>
              <p className="mt-4 text-center text-xs text-text-dim">© 2026 POJU. All rights reserved.</p>
            </div>
          </footer>
        </div>
      </main>
    </MarketingLocaleProvider>
  );
}
