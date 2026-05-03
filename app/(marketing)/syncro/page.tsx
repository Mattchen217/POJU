import Link from "next/link";
import { Suspense } from "react";
import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";
import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { PojuMarkLogo } from "@/components/marketing/poju-mark-logo";
import { SyncroProductHero } from "@/components/marketing/syncro-product-hero";

export const dynamic = "force-dynamic";

const useCases = [
  {
    title: "Study spot",
    body: "Choose a desk orientation that supports steady focus before a deep work block.",
  },
  {
    title: "Negotiation",
    body: "Find a seating orientation that supports confidence and steadier communication.",
  },
  {
    title: "Bed orientation",
    body: "Test sleeping directions and compare how your rest quality changes over time.",
  },
  {
    title: "Travel decision",
    body: "Check directional tone before heading out when timing and clarity both matter.",
  },
  {
    title: "POJU companion",
    body: "Use Syncro as a real-world layer, then return to POJU for deeper decision strategy.",
  },
] as const;

function SyncroContent() {
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
              <Link href="/poju" className="hover:text-text-primary">
                POJU
              </Link>
              <Link href="/glyph" className="hover:text-text-primary">
                Glyph
              </Link>
              <Link href="/syncro" className="text-text-primary">
                Syncro
              </Link>
              <Link href="/archive" className="hover:text-text-primary">
                Archive
              </Link>
            </nav>
            <MarketingLanguageSwitcher />
          </div>
        </header>

        <div className="mx-auto mt-2 w-full max-w-6xl px-4 md:px-8">
          <ArchiveReturnBanner />
        </div>

        <SyncroProductHero />

        <section className="mx-auto mt-10 w-full max-w-6xl px-4 md:mt-14 md:px-8">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            What Syncro shows.
          </h2>
          <div className="mx-auto mt-8 flex max-w-lg flex-col items-center">
            <div className="aspect-[9/19] w-full max-w-[280px] rounded-[2rem] border border-white/15 bg-gradient-to-b from-white/10 to-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-text-dim">Preview</p>
                <p className="mt-3 text-sm leading-7 text-text-secondary">
                  Phone mockup placeholder — replace with a Syncro screen capture when ready.
                </p>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-10 max-w-2xl space-y-4 text-center text-[15px] leading-8 text-text-secondary">
            <p>
              Hold your phone toward a direction.
              <br />
              See what&apos;s available. See what isn&apos;t.
            </p>
            <p className="text-left sm:text-center">
              Each direction shows:
              <br />
              ✦ A short description of the current pattern
              <br />
              ✦ What this period suits (for example, slow conversations)
              <br />
              ✦ What this period doesn&apos;t suit (for example, wait on big asks)
            </p>
            <p>Updated every two hours, with your context.</p>
          </div>
        </section>

        <section id="syncro-use-cases" className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 md:mt-10 md:px-8 md:py-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            Where people use Syncro
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {useCases.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-white/10 bg-black/25 px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <p className="text-[15px] font-semibold text-cyan-100">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-text-secondary">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 md:mt-10 md:px-8 md:py-12">
          <h2 className="text-center text-[28px] font-semibold text-text-primary sm:text-[32px] md:text-[36px]">
            What it is. What it isn&apos;t.
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-8 md:grid-cols-2 md:gap-10">
            <article className="rounded-xl border border-white/10 bg-black/25 p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">What it shows</p>
              <ul className="mt-5 space-y-3 text-[15px] leading-8 text-text-secondary">
                <li>
                  <span className="text-cyan-200">✦</span> Current rhythm pattern for the next 2 hours
                </li>
                <li>
                  <span className="text-cyan-200">✦</span> Eight directions with what they suit
                </li>
                <li>
                  <span className="text-cyan-200">✦</span> Where to lean in, where to slow down
                </li>
              </ul>
            </article>
            <article className="rounded-xl border border-white/10 bg-black/25 p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">What it isn&apos;t</p>
              <ul className="mt-5 space-y-3 text-[15px] leading-8 text-text-secondary">
                <li>
                  <span className="text-red-300/90">✗</span> A predictor of events
                </li>
                <li>
                  <span className="text-red-300/90">✗</span> A promiser of outcomes
                </li>
                <li>
                  <span className="text-red-300/90">✗</span> A replacement for your own judgment
                </li>
              </ul>
            </article>
          </div>
        </section>

        <section className="poju-cosmic-panel mt-8 w-full px-4 py-8 text-center md:mt-10 md:px-8 md:py-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
            <h2 className="text-[30px] font-semibold text-text-primary sm:text-[34px] md:text-[38px]">
              Always free. Forever.
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-8 text-text-secondary sm:text-base">
              Syncro stays free as your everyday directional companion. Open it whenever you need spatial clarity.
            </p>
            <a
              href="https://pojulife.com/syncro"
              className="mt-7 inline-flex rounded-full border border-cyan-300/35 bg-cyan-400/20 px-8 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/25 sm:text-[15px]"
            >
              Open Syncro on mobile
            </a>
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
              Syncro is a self-awareness tool. Take what resonates. Decisions are yours alone.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default function SyncroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
      <SyncroContent />
    </Suspense>
  );
}
