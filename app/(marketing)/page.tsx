import Link from "next/link";
import { Suspense } from "react"; // 只保留这一个导入
import { HeroSpline } from "@/components/marketing/hero-spline";
import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { PojuMarkLogo } from "@/components/marketing/poju-mark-logo";
import { PojuCardCornerVortex } from "@/components/marketing/poju-card-corner-vortex";
import { SyncroCardCornerCompass } from "@/components/marketing/syncro-card-corner-compass";
import { OracleCardParticleCard } from "@/components/marketing/oracle-card-particle-card";
import { ScienceEvidenceSection } from "@/components/marketing/science-evidence-section";
import { TwoTruthsTimelineSection } from "@/components/marketing/two-truths-timeline";
import { StationeryPaperPanel } from "@/components/marketing/stationery-paper-panel";
import { PaymentCancelToast } from "@/components/marketing/payment-cancel-toast";

// 强制动态渲染，解决 build 时的 Prerender 错误
export const dynamic = "force-dynamic";
const productCards = [
  {
    name: "POJU",
    titleLine: "POJU-破局",
    subtitle: "Breakthrough sessions",
    desc: "For the question that won't let you go.",
    badge: "$9.99",
    cta: "Start a session →",
    href: "/poju",
    cardGradient: "linear-gradient(135deg, rgba(106,69,239,0.62) 0%, rgba(53,42,131,0.74) 48%, rgba(20,26,66,0.98) 100%)",
    overlayGradient: "linear-gradient(180deg, rgba(5,8,23,0.10) 0%, rgba(5,8,23,0.35) 100%)",
    iconGradient: "linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)",
    kind: "poju",
  },
  {
    name: "SYNCRO",
    titleLine: "POJU-Syncro",
    subtitle: "See your natural rhythms",
    desc: "A weather forecast for your inner life, updated every two hours.",
    badge: "Free",
    cta: "Open Syncro →",
    href: "/syncro",
    cardGradient: "linear-gradient(135deg, rgba(15,143,208,0.70) 0%, rgba(13,79,132,0.76) 48%, rgba(7,39,70,0.98) 100%)",
    overlayGradient: "linear-gradient(180deg, rgba(3,19,26,0.08) 0%, rgba(3,19,26,0.28) 100%)",
    iconGradient: "linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)",
    kind: "syncro",
  },
  {
    name: "GLYPH",
    titleLine: "POJU-Glyph",
    subtitle: "A 60-second mirror",
    desc: "Read with a wink. The patterns mirror, they don't predict.",
    badge: "Free",
    cta: "Try Glyph →",
    href: "/glyph",
    cardGradient: "linear-gradient(135deg, rgba(243,193,58,0.62) 0%, rgba(138,90,223,0.74) 48%, rgba(47,35,101,0.98) 100%)",
    overlayGradient: "linear-gradient(180deg, rgba(21,15,36,0.08) 0%, rgba(21,15,36,0.30) 100%)",
    iconGradient: "linear-gradient(135deg, #fbbf24 0%, #e879f9 100%)",
    kind: "glyph",
  },
];

function ProductCardIcon({ kind, iconGradient }: { kind: string; iconGradient: string }) {
  if (kind === "poju") {
    return (
      <span
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-[linear-gradient(135deg,rgba(106,69,239,0.45)_0%,rgba(53,42,131,0.65)_60%,rgba(20,26,66,0.9)_100%)] shadow-[0_0_14px_rgba(217,70,239,0.32)] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
        style={{ backgroundImage: iconGradient }}
      >
        <span className="material-symbols-outlined text-[20px] text-white" data-icon="self_improvement">
          self_improvement
        </span>
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

type PromiseIconKind = "noUser" | "shieldLock" | "fingerprint";

function PromiseIcon({ kind, className }: { kind: PromiseIconKind; className?: string }) {
  const cls = className ?? "mx-auto h-11 w-11 shrink-0 text-neutral-900";

  if (kind === "noUser") {
    return (
      <svg className={cls} viewBox="0 0 48 48" fill="none" aria-hidden>
        <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="2" />
        <circle cx="24" cy="18" r="3.8" stroke="currentColor" strokeWidth="2" />
        <path
          d="M16.5 31.5c2.2-4.2 6.5-6.8 7.5-6.8s5.3 2.6 7.5 6.8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M15 14L33 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "shieldLock") {
    return (
      <svg className={cls} viewBox="0 0 48 48" fill="none" aria-hidden>
        <path
          d="M24 7.5L37 13.2V25.8c0 9.6-5.8 17.8-13 21.3-7.2-3.5-13-11.7-13-21.3V13.2L24 7.5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M22.5 24.5v-3a1.5 1.5 0 013 0v3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="19.5" y="24.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg className={cls} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M24 9c-6 3-9 8-9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 12c-4 2.5-6 7-6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 12c4 2.5 6 7 6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 18c-2.5 3-3.5 7-3.5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M31 18c2.5 3 3.5 7 3.5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 25c-1 3-1 6 0 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M33 25c1 3 1 6 0 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 20v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const promiseItems: { title: string; desc: string; iconKind: PromiseIconKind }[] = [
  {
    title: "No Sign Up",
    desc: "Instant access. No barriers between you and insight.",
    iconKind: "noUser",
  },
  {
    title: "Privacy First",
    desc: "Zero data retention. Your queries evaporate instantly.",
    iconKind: "shieldLock",
  },
  {
    title: "Yours Only",
    desc: "Personalized readings tailored uniquely to your context.",
    iconKind: "fingerprint",
  },
];

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
    desc: "Your conversations live only on your device. We encrypt them locally. We cannot read them. No one can.",
    glyph: "homeVault",
  },
  {
    title: "Never required",
    desc: "No account. No login. No password. No email, unless you want your reading as a PDF.",
    glyph: "openPassage",
  },
  {
    title: "Never manipulative",
    desc: "No dark patterns. No fake urgency. No \"limited time.\" No upsells. One price: $9.99 when you need it.",
    glyph: "trueNorth",
  },
];

const protectItems = [
  {
    title: "✦ Your conversations are encrypted on your device.",
    body: "Not \"secured on our servers.\" Encrypted with AES-256-GCM right in your browser, using a key we never see. Even if our servers were breached, there is nothing to steal.",
    verify:
      "Verify it yourself: open DevTools -> Application -> IndexedDB. You'll see encrypted gibberish, not your words.",
  },
  {
    title: "✦ We have no account system.",
    body: "No email at signup. No password. No phone number. No Google/Apple login. Your device fingerprint is your only ID - a one-way hash we use to restore your paid session, nothing else.",
    verify: "Verify it yourself: nothing to sign up for. Try the free tools right now.",
  },
  {
    title: "✦ Your email is forbidden from living on our servers.",
    body: "If you export your reading as PDF, we ask for your email. We send the PDF. Then we delete your address within 24 hours - physically erased from the database. Even we can't reach you after that.",
    verify: "Your control: one-click unsubscribe. Auto-delete everywhere.",
  },
  {
    title: "✦ Anthropic's Zero Data Retention is enabled.",
    body: "Your conversations go through Claude, but Anthropic doesn't save them, doesn't train on them, and doesn't let humans review them. We pay extra specifically for this guarantee.",
    verify: "Verify it yourself: Anthropic's Zero Data Retention policy is public.",
  },
];

export default function LandingPage() {
  return (
    <main className="bg-bg-deep text-text-body">
      {/* 在 main 下面紧跟这一行 */}
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
              <nav className="hidden items-center gap-7 text-[12px] uppercase tracking-[0.12em] text-text-secondary sm:text-[13px] md:flex md:text-[14px]">
                <Link href="/poju" className="hover:text-text-primary">POJU 破局</Link>
                <Link href="/syncro" className="hover:text-text-primary">POJU SYNCRO</Link>
                <Link href="/glyph" className="hover:text-text-primary">POJU GLYPH</Link>
                <Link href="/archive" className="hover:text-text-primary">THE ARCHIVE</Link>
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
                <p className="mx-auto mt-2 max-w-[560px] px-2 text-[13px] leading-6 text-[#e6e8f3] sm:text-sm md:px-0 md:text-[15px]">
                  When one question keeps circling back, POJU sits with you through it. Backed by AI.
                  Grounded in millennia of human reflection.
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
                  No account · No subscription · Decisions are yours alone
                </p>
              </div>
            </div>

            <div id="products" className="relative mx-auto mt-8 w-full max-w-6xl pt-5">
              <h2 className="text-center text-[31px] font-semibold leading-none text-text-primary sm:text-[34px]">POJU · Glyph · Syncro</h2>
              <div className="mt-2 text-center text-[12px] leading-5 text-text-dim">
                AI breakthrough sessions, grounded in millennia of human reflection.
                <br />
                Three ways in. One way through.
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {productCards.map((card, index) => (
                  <article
                    key={card.kind}
                    className={`group relative w-full overflow-hidden rounded-[14px] p-4 aspect-[5/3] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(6,10,28,0.45)] sm:p-5 ${
                      index === 0 ? "lg:scale-[1.02]" : ""
                    }`}
                  >
                    <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]" style={{ backgroundImage: card.cardGradient }} />
                    <div className="absolute inset-0 transition-opacity duration-500 group-hover:opacity-80" style={{ backgroundImage: card.overlayGradient }} />
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
                            {card.titleLine}
                          </p>
                          <p className="mt-0.5 text-[14px] leading-snug text-[#e6eaf5]">
                            {card.subtitle}
                          </p>
                        </div>
                        <span className={index === 0 ? "pt-0.5 text-[16px] font-semibold text-gold-rare" : "pt-0.5 text-[16px] font-semibold text-cyan-bright"}>
                          {card.badge}
                        </span>
                      </div>
                      <p className="mt-3 flex-1 overflow-hidden text-left text-[14px] leading-snug text-[#d8dff0] sm:text-[15px] sm:leading-6">
                        {card.desc}
                      </p>
                      <div className="mt-auto flex items-center justify-start gap-3 pt-3 text-left">
                        <Link href={card.href} className="whitespace-nowrap text-[16px] text-text-body transition-all duration-300 hover:text-text-primary group-hover:translate-x-1">
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

          <div className="bg-white px-4 py-8 md:px-8">
            <h3 className="text-center text-[28px] font-semibold text-neutral-900 sm:text-[32px] md:text-[36px]">Designed for Real Life</h3>
            <div className="mx-auto mt-8 w-full max-w-6xl">
              <div className="grid gap-10 md:grid-cols-3 md:gap-0">
                {promiseItems.map((item, idx) => (
                  <article
                    key={item.title}
                    className={`text-center md:px-8 ${idx < promiseItems.length - 1 ? "md:border-r md:border-neutral-200" : ""}`}
                  >
                    <PromiseIcon kind={item.iconKind} />
                    <p className="mt-4 text-[17px] font-semibold tracking-tight text-neutral-900 sm:text-[18px]">{item.title}</p>
                    <p className="mx-auto mt-2 max-w-[300px] text-[15px] leading-7 text-neutral-700 sm:text-[16px]">{item.desc}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <TwoTruthsTimelineSection />

        <ScienceEvidenceSection />

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
        </section>

        <section
          id="how-we-protect"
          className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 text-left md:mt-10 md:px-8 md:py-12"
        >
          <StationeryPaperPanel>
            <p className="poju-kicker">How we actually keep our word.</p>
            <h2 className="mt-3 max-w-3xl text-xl font-semibold leading-snug text-text-primary sm:text-2xl">
              Privacy isn&apos;t a checkbox. It&apos;s our architecture.
            </h2>
            <div className="mt-8 max-w-3xl space-y-10">
              {protectItems.map((item) => (
                <article key={item.title}>
                  <p className="font-semibold text-text-primary">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-text-secondary">{item.body}</p>
                  <p className="mt-2 text-xs italic leading-relaxed text-text-dim">{item.verify}</p>
                </article>
              ))}
            </div>
            <div className="mt-10 max-w-2xl space-y-4 text-sm leading-7 text-text-secondary">
              <p className="text-pretty hyphens-manual">
                We&apos;re not a company that sells data because we don&apos;t collect data. We&apos;re a company that
                sells one thing: a $9.99 conversation that helps you move through what&apos;s stuck. That&apos;s the
                whole <span className="whitespace-nowrap">business model.</span>
              </p>
              <p>
                If you ever doubt us: every claim on this page can be verified in a minute with your browser&apos;s
                DevTools or public documentation.
              </p>
            </div>
            <Link href="/privacy" className="mt-6 inline-block text-sm text-text-accent hover:text-purple-vivid">
              Read our full Privacy Policy →
            </Link>
          </StationeryPaperPanel>
        </section>

        <section className="poju-cosmic-panel mt-8 w-full px-4 py-8 text-center md:mt-10 md:px-8 md:py-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
            <h2 className="text-[30px] font-semibold text-text-primary sm:text-3xl">Ready to break through?</h2>
            <p className="mt-2 max-w-xl text-sm text-text-secondary sm:text-[15px]">One question. $9.99. Delivered in one conversation.</p>
            <Link
              href="/poju"
              className="mt-5 inline-flex w-full max-w-[260px] min-w-[180px] justify-center rounded-full border border-[#7b5cff] bg-[#6d4dff] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(109,77,255,0.42)] hover:bg-[#7a5dff] sm:w-auto"
            >
              Ask Your Question →
            </Link>
          </div>
        </section>

        <footer className="mt-8 w-full rounded-xl bg-bg-layer-1/60 px-4 py-6 md:px-8">
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-lg font-semibold tracking-[0.12em] text-text-primary">POJU</p>
            <p className="mt-1 text-sm text-text-secondary">pojulife.com</p>
            <div className="my-4 h-px bg-gradient-to-r from-transparent via-glass-border to-transparent" />
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-text-secondary">
              <Link href="/disclaimer" className="hover:text-text-primary">Disclaimer</Link>
              <Link href="/privacy" className="hover:text-text-primary">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-text-primary">Terms of Service</Link>
              <Link href="/contact" className="hover:text-text-primary">Contact</Link>
            </div>
            <p className="mt-4 text-center text-xs text-text-dim">© 2026 POJU. All rights reserved.</p>
            <p className="mt-2 text-center text-xs text-text-dim">
              For reflection and entertainment. POJU does not predict outcomes or replace professional advice.
            </p>
          </div>
        </footer>
      </div> 

      </Suspense> 
    </main>
  );
}
