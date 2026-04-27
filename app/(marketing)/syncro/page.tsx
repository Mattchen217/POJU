import Link from "next/link";
import { Suspense } from "react";
import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";
import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { PojuMarkLogo } from "@/components/marketing/poju-mark-logo";
import { SyncroProductHero } from "@/components/marketing/syncro-product-hero";
import { SyncroMobileFlow } from "@/components/syncro/syncro-mobile-flow";

// 1. 强制动态渲染，解决 build 时的 Prerender 错误
export const dynamic = "force-dynamic";

const useCases = [
  {
    title: "Study spot",
    body: "Choose the desk direction with calmer focus energy before a deep work block.",
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

const scienceVsEast = [
  {
    science: "Compass heading + geomagnetic field",
    east: "Directional Qi tendency",
  },
  {
    science: "GPS coordinates + local context",
    east: "Place-based energetic pattern",
  },
  {
    science: "Timestamp + circadian timing",
    east: "Moment-based fortune rhythm",
  },
  {
    science: "Personal data model and calibration",
    east: "Bazi-aligned personal blueprint",
  },
] as const;

// 2. 将原本的内容移入一个内部组件
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
            <nav className="hidden items-center gap-7 text-[12px] uppercase tracking-[0.12em] text-text-secondary sm:text-[13px] md:flex md:text-[14px]">
              <Link href="/poju" className="hover:text-text-primary">
                POJU 破局
              </Link>
              <Link href="/syncro" className="text-text-primary">
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

        <div className="mx-auto mt-2 w-full max-w-6xl px-4 md:px-8">
          <ArchiveReturnBanner />
        </div>

        <SyncroProductHero />
        <SyncroMobileFlow />

        <section className="mx-auto mt-8 w-full max-w-6xl px-4 py-8 md:mt-10 md:px-8 md:py-10">
          <div className="grid gap-6 rounded-2xl border border-white/10 bg-black/25 p-5 sm:p-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/85">PC fallback</p>
              <h2 className="mt-2 text-[24px] font-semibold text-text-primary sm:text-[28px]">
                Open Syncro on mobile for full experience
              </h2>
              <p className="mt-3 text-sm leading-7 text-text-secondary">
                Syncro needs compass, GPS, and camera. On desktop, scan the QR code or send the link to your phone.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  type="tel"
                  placeholder="Phone number"
                  className="w-full rounded-lg border border-white/10 bg-bg-layer-1/50 px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:border-cyan-300/35 focus:outline-none"
                />
                <button
                  type="button"
                  className="rounded-lg border border-cyan-300/35 bg-cyan-400/20 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-300/25"
                >
                  Text me the link
                </button>
              </div>
            </div>
            <div className="mx-auto w-full max-w-[220px] rounded-xl border border-white/12 bg-bg-layer-1/40 p-4 text-center">
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=https%3A%2F%2Fpojulife.com%2Fsyncro"
                alt="QR code for Syncro mobile link"
                className="h-auto w-full rounded-md"
              />
              <p className="mt-3 text-xs text-text-dim">pojulife.com/syncro</p>
            </div>
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
            Science × Eastern Lens
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[15px] leading-7 text-text-secondary">
            Syncro does not replace either worldview. It maps measurable signals and classical directional logic into
            one practical view.
          </p>
          <div className="mt-8 overflow-hidden rounded-xl border border-white/12 bg-black/25">
            <div className="grid grid-cols-2 border-b border-white/10 text-[12px] uppercase tracking-[0.14em] text-text-dim">
              <p className="px-4 py-3 sm:px-5">Science side</p>
              <p className="border-l border-white/10 px-4 py-3 sm:px-5">Eastern side</p>
            </div>
            {scienceVsEast.map((row) => (
              <div key={row.science} className="grid grid-cols-2 border-b border-white/5 last:border-0">
                <p className="px-4 py-4 text-sm leading-7 text-text-primary sm:px-5">{row.science}</p>
                <p className="border-l border-white/10 px-4 py-4 text-sm leading-7 text-cyan-100 sm:px-5">{row.east}</p>
              </div>
            ))}
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
              Not medical, legal, or financial advice. Consult licensed professionals for those matters.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}

// 3. 默认导出的页面组件，使用 Suspense 包裹子组件
export default function SyncroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
      <SyncroContent />
    </Suspense>
  );
}