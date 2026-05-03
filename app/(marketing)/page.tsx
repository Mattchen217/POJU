import Link from "next/link";
import { Suspense } from "react";
import { Compass, Clock, Layers, UserCircle, Waves } from "lucide-react";
import { HeroSpline } from "@/components/marketing/hero-spline";
import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { PojuMarkLogo } from "@/components/marketing/poju-mark-logo";
import { PojuCardCornerVortex } from "@/components/marketing/poju-card-corner-vortex";
import { SyncroCardCornerCompass } from "@/components/marketing/syncro-card-corner-compass";
import { OracleCardParticleCard } from "@/components/marketing/oracle-card-particle-card";
import { PaymentCancelToast } from "@/components/marketing/payment-cancel-toast";

export const dynamic = "force-dynamic";

const productCards = [
  {
    name: "POJU",
    line1: "For the question that won't let you go.",
    line2: "A single deep conversation, until you see it through.",
    badge: "$9.99",
    cta: "Try it →",
    href: "/poju",
    cardGradient: "linear-gradient(135deg, rgba(106,69,239,0.62) 0%, rgba(53,42,131,0.74) 48%, rgba(20,26,66,0.98) 100%)",
    overlayGradient: "linear-gradient(180deg, rgba(5,8,23,0.10) 0%, rgba(5,8,23,0.35) 100%)",
    iconGradient: "linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)",
    kind: "poju",
  },
  {
    name: "Glyph",
    line1: "A 60-second mirror.",
    line2: "Hold a question. Draw a pattern. Read a reflection.",
    badge: "Free",
    cta: "Try it →",
    href: "/glyph",
    cardGradient: "linear-gradient(135deg, rgba(243,193,58,0.62) 0%, rgba(138,90,223,0.74) 48%, rgba(47,35,101,0.98) 100%)",
    overlayGradient: "linear-gradient(180deg, rgba(21,15,36,0.08) 0%, rgba(21,15,36,0.30) 100%)",
    iconGradient: "linear-gradient(135deg, #fbbf24 0%, #e879f9 100%)",
    kind: "glyph",
  },
  {
    name: "Syncro",
    line1: "See your natural rhythms.",
    line2: "Updated every two hours, on your phone.",
    badge: "Free",
    cta: "Try it →",
    href: "/syncro",
    cardGradient: "linear-gradient(135deg, rgba(15,143,208,0.70) 0%, rgba(13,79,132,0.76) 48%, rgba(7,39,70,0.98) 100%)",
    overlayGradient: "linear-gradient(180deg, rgba(3,19,26,0.08) 0%, rgba(3,19,26,0.28) 100%)",
    iconGradient: "linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)",
    kind: "syncro",
  },
];

function ProductCardIcon({ kind, iconGradient }: { kind: string; iconGradient: string }) {
  const ring =
    "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 shadow-[0_0_14px_rgba(255,255,255,0.12)] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3";

  if (kind === "poju") {
    return (
      <span className={ring} style={{ backgroundImage: iconGradient }}>
        <Layers className="h-5 w-5 text-white" strokeWidth={1.5} aria-hidden />
      </span>
    );
  }

  if (kind === "syncro") {
    return (
      <span
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-[11px] border border-white/30 shadow-[0_0_14px_rgba(34,211,238,0.3)] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
        style={{ backgroundImage: iconGradient }}
      >
        <span className="h-5 w-5 rotate-45 rounded-[2px] border border-white/80" />
        <span className="absolute h-0.5 w-4 bg-white/85" />
        <span className="absolute h-4 w-0.5 bg-white/85" />
      </span>
    );
  }

  return (
    <span
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-[11px] border border-white/30 shadow-[0_0_14px_rgba(232,121,249,0.32)] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
      style={{ backgroundImage: iconGradient }}
    >
      <span className="h-5 w-5 rotate-45 rounded-[2px] border border-white/85" />
      <span className="absolute h-2 w-2 rotate-45 rounded-[1px] border border-white/85" />
    </span>
  );
}

function ProductCardEffect({ kind }: { kind: string }) {
  return null;
}

type ThreePromiseGlyphId = "homeVault" | "openPassage" | "trueNorth";

function ThreePromiseGlyph({ id, className }: { id: ThreePromiseGlyphId; className?: string }) {
  const cls = `h-11 w-11 shrink-0 ${className ?? ""}`;
  if (id === "homeVault") {
    return (
      <svg className={cls} viewBox="0 0 48 48" fill="none" aria-hidden>
        <path
          d="M24 8L10 20v18h7V27h14v11h7V20L24 8z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <rect x="20" y="28" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
        <path d="M21.5 28v-2.25a2.5 2.5 0 015 0V28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "openPassage") {
    return (
      <svg className={cls} viewBox="0 0 48 48" fill="none" aria-hidden>
        <path d="M24 11v24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M24 13c-7.5 0-9.5 4-9.5 9.5V36"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M24 13c7.5 0 9.5 4 9.5 9.5V36"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M17 17l-6-5M31 17l6-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M24 9l5 10 10 5-10 5-5 10-5-10-10-5 10-5 5-10z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="3" fill="currentColor" />
    </svg>
  );
}

const threePromiseAccents = [
  "text-violet-400 transition-[color,filter] duration-300 group-hover:text-violet-300 group-hover:drop-shadow-[0_0_14px_rgba(167,139,250,0.5)] motion-reduce:group-hover:drop-shadow-none",
  "text-cyan-400 transition-[color,filter] duration-300 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_14px_rgba(34,211,238,0.5)] motion-reduce:group-hover:drop-shadow-none",
  "text-amber-300 transition-[color,filter] duration-300 group-hover:text-amber-200 group-hover:drop-shadow-[0_0_14px_rgba(252,211,77,0.45)] motion-reduce:group-hover:drop-shadow-none",
] as const;

const threePromisesItems: { title: string; desc: string; glyph: ThreePromiseGlyphId }[] = [
  {
    title: "Never stored",
    desc: "Your conversations live encrypted on your device. We can\u2019t read them. No one can.",
    glyph: "homeVault",
  },
  {
    title: "Never required",
    desc: "No account. No login. No password. Email only when you want a PDF.",
    glyph: "openPassage",
  },
  {
    title: "Never manipulative",
    desc: "No dark patterns. No fake urgency. One price: $9.99 when you need it.",
    glyph: "trueNorth",
  },
];

const twoLanguagesGrid = [
  {
    title: "PATTERN",
    Icon: Waves,
    body: "Ancient observation on what recurs.",
  },
  {
    title: "DIRECTION",
    Icon: Compass,
    body: "Spatial psychology on what we notice.",
  },
  {
    title: "TIMING",
    Icon: Clock,
    body: "Cycles that shape biology.",
  },
  {
    title: "YOU",
    Icon: UserCircle,
    body: "Your birth context, moment, and question.",
  },
];

export default function LandingPage() {
  return (
    <main className="bg-bg-deep text-text-body">
      <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
        <PaymentCancelToast />
        <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
          <section>
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

            <div className="relative overflow-hidden pb-8 pt-8 sm:pb-10 sm:pt-10 md:pb-14 md:pt-14">
              <HeroSpline className="pointer-events-none absolute -top-16 left-0 right-0 h-[430px] opacity-75 sm:-top-20 sm:h-[520px] md:-top-28 md:h-[660px]" />
              <div className="relative z-10 mx-auto grid min-h-[360px] w-full max-w-6xl items-center gap-8 sm:min-h-[420px] md:min-h-[520px] md:grid-cols-[1fr]">
                <div className="text-center">
                  <h1 className="text-[36px] font-semibold leading-[1.06] text-text-primary sm:text-[44px] md:text-[56px] lg:text-[62px]">
                    POJU
                  </h1>
                <p className="mx-auto mt-4 max-w-[560px] px-2 text-[13px] leading-6 text-[#e6e8f3] sm:text-sm md:px-0 md:text-[15px]">
                  Where AI meets a thousand years of wisdom.
                </p>
                  <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link
                      href="/poju"
                      className="inline-flex w-full max-w-[260px] min-w-[180px] justify-center rounded-full border border-[#7b5cff] bg-[#6d4dff] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(109,77,255,0.42)] hover:bg-[#7a5dff] sm:w-auto"
                    >
                      Start a POJU session · $9.99
                    </Link>
                    <Link
                      href="/glyph"
                      className="poju-button-secondary inline-flex w-full max-w-[260px] min-w-[160px] justify-center !px-5 !py-2.5 sm:w-auto"
                    >
                      Try Glyph · Free
                    </Link>
                  </div>
                  <p className="mx-auto mt-3 text-xs text-text-dim">
                    No account · No subscription · Yours to decide
                  </p>
                </div>
              </div>

              <div id="products" className="relative mx-auto mt-8 w-full max-w-6xl pt-5">
                <h2 className="text-center text-[28px] font-semibold leading-tight text-text-primary sm:text-[31px] md:text-[34px]">
                  Three ways in. One way through.
                </h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {productCards.map((card, index) => (
                    <article
                      key={card.kind}
                      className={`group relative w-full overflow-hidden rounded-[14px] p-4 aspect-[5/3] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(6,10,28,0.45)] sm:p-5 ${
                        index === 0 ? "lg:scale-[1.02]" : ""
                      }`}
                    >
                      <div
                        className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]"
                        style={{ backgroundImage: card.cardGradient }}
                      />
                      <div
                        className="absolute inset-0 transition-opacity duration-500 group-hover:opacity-80"
                        style={{ backgroundImage: card.overlayGradient }}
                      />
                      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                        <div className="absolute -inset-10 bg-[radial-gradient(circle_at_70%_70%,rgba(255,255,255,0.18),transparent_55%)]" />
                      </div>
                      {card.kind === "poju" ? <PojuCardCornerVortex /> : null}
                      <ProductCardEffect kind={card.kind} />
                      <div className="relative z-10 flex h-full min-h-0 flex-col text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div className="shrink-0">
                            <ProductCardIcon kind={card.kind} iconGradient={card.iconGradient} />
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-[15px] font-semibold leading-tight tracking-[0.06em] text-text-primary">
                              {card.name}
                            </p>
                          </div>
                          <span
                            className={
                              index === 0
                                ? "pt-0.5 text-[16px] font-semibold text-gold-rare"
                                : "pt-0.5 text-[16px] font-semibold text-cyan-bright"
                            }
                          >
                            {card.badge}
                          </span>
                        </div>
                        <div className="mt-3 flex-1 space-y-1.5 overflow-hidden text-left text-[14px] leading-snug text-[#d8dff0] sm:text-[15px] sm:leading-6">
                          <p>{card.line1}</p>
                          <p>{card.line2}</p>
                        </div>
                        <div className="mt-auto flex items-center justify-start gap-3 pt-3 text-left">
                          <Link
                            href={card.href}
                            className="whitespace-nowrap text-[16px] text-text-body transition-all duration-300 hover:text-text-primary group-hover:translate-x-1"
                          >
                            {card.cta}
                          </Link>
                        </div>
                      </div>
                      {card.kind === "syncro" ? <SyncroCardCornerCompass /> : null}
                      {card.kind === "glyph" ? <OracleCardParticleCard /> : null}
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto mt-10 w-full max-w-6xl px-4 py-12 md:mt-14 md:px-8 md:py-16">
            <h2 className="text-center text-[26px] font-semibold text-text-primary sm:text-[30px] md:text-[32px]">
              Where two languages meet.
            </h2>
            <div className="mx-auto mt-4 max-w-2xl text-center text-[14px] leading-7 text-text-secondary sm:text-[15px] sm:leading-8">
              <p>Two thousand years of human reflection.</p>
              <p className="mt-1">Modern AI translation.</p>
              <p className="mt-1">One conversation that helps you see clearly.</p>
            </div>
            <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {twoLanguagesGrid.map(({ title, Icon, body }) => (
                <div key={title} className="flex flex-col items-center text-center">
                  <Icon className="h-9 w-9 text-purple-400" strokeWidth={1.5} aria-hidden />
                  <p className="mt-4 text-[12px] font-semibold tracking-[0.14em] text-text-primary">{title}</p>
                  <p className="mt-2 text-[14px] leading-7 text-text-secondary sm:text-[15px]">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 md:mt-10 md:px-8 md:py-12">
            <h2 className="text-center text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px] md:text-[36px]">
              Three promises we don&apos;t break.
            </h2>
            <div className="mx-auto mt-8 w-full max-w-6xl md:mt-10">
              <div className="grid gap-10 md:grid-cols-3 md:gap-0">
                {threePromisesItems.map((item, idx) => (
                  <article
                    key={item.title}
                    className={`group text-center transition-transform duration-300 motion-reduce:transition-none md:px-8 ${
                      idx < threePromisesItems.length - 1 ? "md:border-r md:border-white/12" : ""
                    }`}
                  >
                    <div className="mx-auto flex justify-center transition-transform duration-300 ease-out will-change-transform group-hover:scale-110 motion-reduce:group-hover:scale-100">
                      <ThreePromiseGlyph id={item.glyph} className={threePromiseAccents[idx]} />
                    </div>
                    <p className="mt-4 inline-block text-[17px] font-semibold tracking-tight text-text-primary transition-transform duration-300 ease-out group-hover:scale-[1.04] motion-reduce:group-hover:scale-100 sm:text-[18px]">
                      {item.title}
                    </p>
                    <p className="mx-auto mt-2 max-w-[300px] text-[15px] leading-7 text-text-secondary transition-colors duration-300 group-hover:text-[#e4e8f5] motion-reduce:group-hover:text-inherit sm:text-[16px]">
                      {item.desc}
                    </p>
                  </article>
                ))}
              </div>
            </div>
            <p className="mt-10 text-center">
              <Link
                href="/privacy#privacy-architecture"
                className="text-sm font-medium text-text-accent underline-offset-4 hover:text-purple-vivid hover:underline sm:text-[15px]"
              >
                Read the full privacy architecture →
              </Link>
            </p>
          </section>

          <section className="poju-cosmic-panel mt-8 w-full px-4 py-8 text-center md:mt-10 md:px-8 md:py-10">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
              <h2 className="text-[28px] font-semibold text-text-primary sm:text-[30px] md:text-[32px]">
                When the question won&apos;t let you go.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-text-secondary sm:text-[15px]">One question. $9.99. Delivered in one conversation.</p>
              <Link
                href="/poju"
                className="mt-5 inline-flex w-full max-w-[260px] min-w-[180px] justify-center rounded-full border border-[#7b5cff] bg-[#6d4dff] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(109,77,255,0.42)] hover:bg-[#7a5dff] sm:w-auto"
              >
                Ask Your Question →
              </Link>
              <Link
                href="/glyph"
                className="mt-4 text-sm font-medium text-fuchsia-200/90 underline-offset-4 hover:text-fuchsia-100 hover:underline sm:text-[15px]"
              >
                Or try Glyph for free first →
              </Link>
            </div>
          </section>

          <footer className="mt-8 w-full rounded-xl bg-bg-layer-1/60 px-4 py-6 md:px-8">
            <div className="mx-auto max-w-6xl text-center">
              <p className="text-lg font-semibold tracking-[0.12em] text-text-primary">POJU</p>
              <p className="mt-1 text-sm text-text-secondary">pojulife.com</p>
              <div className="my-4 h-px bg-gradient-to-r from-transparent via-glass-border to-transparent" />
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-text-secondary">
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
                For self-reflection and entertainment. POJU offers perspectives, not predictions. All decisions are yours alone.
              </p>
            </div>
          </footer>
        </div>
      </Suspense>
    </main>
  );
}
