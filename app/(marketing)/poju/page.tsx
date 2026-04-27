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
    body: "career change, relationship decision, relocation",
  },
  {
    title: "You've done your research and you're more confused",
    body: "conflicting advice, family pressure, ticking clock",
  },
  {
    title: "Something keeps repeating and you don't know why",
    body: "same kind of relationship, same setbacks, same blocks",
  },
  {
    title: "You need depth that friends can't give",
    body: "no one around you has the distance to see clearly",
  },
  {
    title: "You want direction, not prediction",
    body: '"will X happen" is astrology. "what should I do" is POJU.',
  },
] as const;

const howSteps = [
  "Issue Identification",
  "Information Collection",
  "Auxiliary Tools Judgment",
  "Core Analysis",
  "Action Generation",
  "Implementation Tracking",
] as const;

const compareRows: { label: string; dots: [number, number, number, number] }[] = [
  { label: "Depth", dots: [1, 2, 4, 3] },
  { label: "Actionable", dots: [1, 2, 4, 4] },
  { label: "Eastern Base", dots: [2, 1, 4, 4] },
  { label: "Privacy", dots: [1, 1, 1, 4] },
];

function DotCell({ count, max = 4 }: { count: number; max?: number }) {
  return (
    <span className="inline-flex justify-center gap-1 text-[15px] sm:text-base">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < count ? "text-purple-vivid" : "text-text-dim/20"} aria-hidden>
          ●
        </span>
      ))}
    </span>
  );
}

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
            <nav className="hidden items-center gap-7 text-[12px] uppercase tracking-[0.12em] text-text-secondary sm:text-[13px] md:flex md:text-[14px]">
              <Link href="/poju" className="text-text-primary">
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

        <PojuProductHero />

        <section
          id="oracle-vs-poju"
          className="mx-auto mt-8 w-full max-w-3xl scroll-mt-28 px-4 pt-2 pb-2 md:px-8"
        >
          <div className="rounded-2xl border border-white/10 bg-black/25 px-5 py-6 sm:px-7 sm:py-7">
            <h2 className="text-center text-[22px] font-semibold text-text-primary sm:text-[24px]">
              Oracle vs POJU
            </h2>
            <p className="mt-4 text-center text-[15px] leading-8 text-text-secondary sm:text-base">
              <span className="font-medium text-fuchsia-200">Oracle</span> is free and fast — one sincere question, one
              sign in about two minutes. <span className="font-medium text-purple-vivid">POJU</span> is a paid session
              that walks with you for much longer when you need a full breakthrough, not only a direction.
            </p>
            <p className="mt-3 text-center text-sm text-text-dim">
              Full side-by-side lives on the Oracle page. Jump there if you are still choosing.
            </p>
            <div className="mt-5 flex justify-center">
              <Link
                href="/oracle#oracle-poju-compare"
                className="text-sm font-medium text-fuchsia-200/90 underline-offset-4 hover:text-fuchsia-100 hover:underline sm:text-[15px]"
              >
                Open the Oracle comparison table →
              </Link>
            </div>
          </div>
        </section>

        <section id="when-to-poju" className="relative mx-auto mt-8 w-full max-w-6xl px-4 pt-5 pb-10 md:px-8 md:pb-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            When to come to POJU
          </h2>
          <div className="mx-auto mt-8 max-w-3xl space-y-10 sm:mt-10 sm:space-y-12 md:mt-10">
            {whenScenarios.map((item) => (
              <article key={item.title} className="text-left">
                <p className="text-[16px] font-semibold tracking-[0.06em] text-text-primary sm:text-lg md:text-xl">
                  <span className="text-purple-vivid">✦</span> {item.title}
                </p>
                <p className="mt-3 text-[15px] leading-8 text-text-secondary sm:text-base sm:leading-8">{item.body}</p>
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

        <section id="why-poju" className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 md:mt-10 md:px-8 md:py-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">Why POJU is different</h2>
          <div className="mt-8 overflow-x-auto rounded-xl border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:mt-10 md:mt-10">
            <table
              className="w-full min-w-[560px] border-collapse text-left text-[15px] sm:min-w-[600px] sm:text-base"
              aria-label="Comparison: Co-Star, ChatGPT, Real Master, and POJU"
            >
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-text-dim sm:text-xs">
                  <th className="px-5 py-4 font-medium sm:px-6 sm:py-5" scope="col">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th className="px-4 py-4 font-medium sm:px-5 sm:py-5" scope="col">
                    Co-Star
                  </th>
                  <th className="px-4 py-4 font-medium sm:px-5 sm:py-5" scope="col">
                    ChatGPT
                  </th>
                  <th className="px-4 py-4 font-medium sm:px-5 sm:py-5" scope="col">
                    Real Master
                  </th>
                  <th className="px-4 py-4 font-medium text-purple-vivid sm:px-5 sm:py-5" scope="col">
                    POJU
                  </th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                {compareRows.map((row) => (
                  <tr key={row.label} className="border-b border-white/5 last:border-0">
                    <th className="px-5 py-4 font-medium text-text-primary sm:px-6 sm:py-5" scope="row">
                      {row.label}
                    </th>
                    {row.dots.map((n, col) => (
                      <td key={col} className="px-4 py-4 text-center sm:px-5 sm:py-5">
                        <DotCell count={n} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th className="px-5 py-4 font-medium text-text-primary sm:px-6 sm:py-5" scope="row">
                    Price
                  </th>
                  <td className="px-4 py-4 sm:px-5 sm:py-5">$8/yr</td>
                  <td className="px-4 py-4 sm:px-5 sm:py-5">$20/mo</td>
                  <td className="px-4 py-4 sm:px-5 sm:py-5">$150–500</td>
                  <td className="px-4 py-4 font-semibold text-text-primary sm:px-5 sm:py-5">$9.99 single</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="before-you-pay" className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 md:mt-10 md:px-8 md:py-12">
          <div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-black/25 px-6 py-8 text-left sm:px-8 sm:py-10 md:px-10 md:py-11">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-text-dim sm:text-[13px]">
              Before you pay — what happens to your words:
            </p>
            <ul className="mt-5 space-y-3 text-[15px] leading-8 text-text-secondary sm:mt-6 sm:text-base">
              <li>
                <span className="text-purple-vivid">✦</span> Encrypted on your device only.
              </li>
              <li>
                <span className="text-purple-vivid">✦</span> Never stored on our servers.
              </li>
              <li>
                <span className="text-purple-vivid">✦</span> Deleted when you close — even from us.
              </li>
            </ul>
            <Link
              href="/#how-we-protect"
              className="mt-6 inline-block text-[15px] text-text-accent underline-offset-4 hover:text-purple-vivid hover:underline sm:text-base"
            >
              How we actually keep our word →
            </Link>
          </div>
        </section>

        <section id="poju-cta" className="poju-cosmic-panel mt-8 w-full px-4 py-8 text-center md:mt-10 md:px-8 md:py-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
            <h2 className="text-[30px] font-semibold text-text-primary sm:text-[34px] md:text-[38px] lg:text-[40px]">
              Ready to break through?
            </h2>
            <Link
              href="/chat?token=ui-preview"
              className="mt-8 inline-flex w-full max-w-[300px] min-w-[220px] justify-center rounded-full border border-[#7b5cff] bg-[#6d4dff] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_26px_rgba(109,77,255,0.42)] hover:bg-[#7a5dff] sm:mt-10 sm:w-auto md:px-10 md:py-4 md:text-base"
            >
              Ask your question — $9.99
            </Link>
            <p className="mt-6 max-w-xl text-sm leading-7 text-text-secondary sm:mt-7 sm:text-[15px] md:text-base">
              One question · Unlimited depth · PDF by email · Deletes when you close.
            </p>
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
              Not medical, legal, or financial advice. Consult licensed professionals for those matters.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
