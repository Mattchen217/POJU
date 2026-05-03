import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { PojuMarkLogo } from "@/components/marketing/poju-mark-logo";
import { PojuHowWorksRing } from "@/components/marketing/poju-how-works-ring";
import { PojuProductHero } from "@/components/marketing/poju-product-hero";

export const metadata: Metadata = {
  title: "POJU — Break your deadlock",
  description:
    "Guided by 2,000 years of Eastern wisdom, reinforced by modern science, delivered by an AI Agent that walks with you.",
};
export const dynamic = "force-dynamic";

const whenScenarios = [
  {
    title: "You're stuck between two paths",
    body: "Career change. Relationship decision. Where to live.",
  },
  {
    title: "You've done your research and you're more confused",
    body: "Conflicting advice. Family pressure. A ticking clock.",
  },
  {
    title: "Something keeps repeating and you don't know why",
    body: "Same kind of relationship. Same blocks. Same setbacks.",
  },
  {
    title: "You need depth that friends can't give",
    body: "No one around you has the distance to see clearly.",
  },
  {
    title: "You want direction, not prediction",
    body: '"Will X happen" is astrology. "What should I do" is POJU.',
  },
] as const;

const howSteps = [
  "Issue Identification",
  "Information Collection",
  "Pattern Analysis",
  "Core Analysis",
  "Action Generation",
  "Implementation Tracking",
] as const;

export default function PojuProductPage() {
  return (
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
            <nav className="hidden items-center gap-7 text-[12px] tracking-[0.12em] text-text-secondary sm:text-[13px] md:flex md:text-[14px]">
              <Link href="/poju" className="text-text-primary">
                POJU
              </Link>
              <Link href="/glyph" className="hover:text-text-primary">
                Glyph
              </Link>
              <Link href="/syncro" className="hover:text-text-primary">
                Syncro
              </Link>
              <Link href="/archive" className="hover:text-text-primary">
                Archive
              </Link>
            </nav>
            <MarketingLanguageSwitcher />
          </div>
        </header>

        <PojuProductHero />

        <section id="when-to-poju" className="relative mx-auto mt-8 w-full max-w-6xl px-4 pt-5 pb-10 md:px-8 md:pb-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            When to come to POJU.
          </h2>
          <div className="mx-auto mt-8 max-w-3xl space-y-10 sm:mt-10 sm:space-y-12 md:mt-10">
            {whenScenarios.map((item) => (
              <article key={item.title} className="text-left">
                <p className="text-[16px] font-semibold tracking-[0.06em] text-text-primary sm:text-lg md:text-xl">
                  <span className="text-purple-vivid">✦</span> {item.title}
                </p>
                <p className="mt-3 pl-0 text-[15px] leading-8 text-text-secondary sm:pl-4 sm:text-base sm:leading-8 md:pl-6">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-poju-works" className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 md:mt-10 md:px-8 md:py-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">How POJU works</h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-[15px] leading-7 text-text-secondary sm:mt-6 sm:text-base md:mt-7">
            Not a single answer — a continuous breakthrough loop.
          </p>
          <PojuHowWorksRing steps={howSteps} />
          <ol className="sr-only">
            {howSteps.map((label, idx) => (
              <li key={label}>
                Step {idx + 1}: {label}
              </li>
            ))}
          </ol>
          <p className="mx-auto mt-8 max-w-2xl text-center text-[15px] leading-8 text-text-secondary sm:mt-10 sm:text-base md:mt-10">
            You act. You come back. The path adjusts. Until you move through.
          </p>
        </section>

        <section id="poju-cta" className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 md:mt-10 md:px-8 md:py-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            Two columns, one promise.
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-8 md:grid-cols-2 md:gap-10">
            <article className="rounded-xl border border-white/10 bg-black/25 p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">What&apos;s included</p>
              <ul className="mt-5 space-y-3 text-[15px] leading-8 text-text-secondary">
                <li>
                  <span className="text-purple-vivid">✦</span> Unlimited depth in a single session
                </li>
                <li>
                  <span className="text-purple-vivid">✦</span> Action plan you can act on tomorrow
                </li>
                <li>
                  <span className="text-purple-vivid">✦</span> Reflection prompts to sit with
                </li>
                <li>
                  <span className="text-purple-vivid">✦</span> 30-day session access
                </li>
              </ul>
            </article>
            <article className="rounded-xl border border-white/10 bg-black/25 p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">What it&apos;s not</p>
              <ul className="mt-5 space-y-3 text-[15px] leading-8 text-text-secondary">
                <li>
                  <span className="text-red-300/90">✗</span> Does not predict your future
                </li>
                <li>
                  <span className="text-red-300/90">✗</span> Does not replace professional advice
                </li>
                <li>
                  <span className="text-red-300/90">✗</span> Does not make decisions for you
                </li>
              </ul>
            </article>
          </div>
          <p className="mx-auto mt-10 max-w-xl text-center text-[15px] leading-8 text-text-secondary">
            POJU is a thinking partner. The decisions remain yours.
          </p>
          <div className="poju-cosmic-panel mt-10 w-full px-2 py-8 text-center md:px-4 md:py-10">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
              <Link
                href="/chat?token=ui-preview"
                className="inline-flex w-full max-w-[300px] min-w-[220px] justify-center rounded-full border border-[#7b5cff] bg-[#6d4dff] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_26px_rgba(109,77,255,0.42)] hover:bg-[#7a5dff] sm:w-auto md:px-10 md:py-4 md:text-base"
              >
                Ask your question — $9.99
              </Link>
              <p className="mt-6 max-w-xl text-sm leading-7 text-text-secondary sm:mt-7 sm:text-[15px] md:text-base">
                One question · Unlimited depth · PDF by email · Deletes when you close
              </p>
            </div>
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
            <p className="mt-2 text-center text-xs text-text-dim">
              POJU is a thinking partner. It offers perspectives, not prophecies. All decisions are yours alone.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
