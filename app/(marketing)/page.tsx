import Link from "next/link";
import { HeroSpline } from "@/components/marketing/hero-spline";
import { PojuCardCornerVortex } from "@/components/marketing/poju-card-corner-vortex";
import { SyncroCardCornerCompass } from "@/components/marketing/syncro-card-corner-compass";
import { OracleCardParticleCard } from "@/components/marketing/oracle-card-particle-card";

const productCards = [
  {
    name: "POJU",
    titleLine: "POJU-破局",
    subtitle: "Breakthrough Q&A",
    desc: "Deep analysis, actionable plans, real results.",
    badge: "$9.9",
    cta: "Learn more →",
    href: "/poju",
    cardGradient: "linear-gradient(135deg, rgba(106,69,239,0.62) 0%, rgba(53,42,131,0.74) 48%, rgba(20,26,66,0.98) 100%)",
    overlayGradient: "linear-gradient(180deg, rgba(5,8,23,0.10) 0%, rgba(5,8,23,0.35) 100%)",
    iconGradient: "linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)",
    kind: "poju",
  },
  {
    name: "SYNCRO",
    titleLine: "POJU-Syncro",
    subtitle: "Energy Field",
    desc: "Analyze spatial energy using Bazi, location and time.",
    badge: "Free",
    cta: "Open Syncro →",
    href: "/syncro",
    cardGradient: "linear-gradient(135deg, rgba(15,143,208,0.70) 0%, rgba(13,79,132,0.76) 48%, rgba(7,39,70,0.98) 100%)",
    overlayGradient: "linear-gradient(180deg, rgba(3,19,26,0.08) 0%, rgba(3,19,26,0.28) 100%)",
    iconGradient: "linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)",
    kind: "syncro",
  },
  {
    name: "ORACLE",
    titleLine: "POJU-Oracle",
    subtitle: "Ancient Guidance",
    desc: "Draw cards for timeless insights and inspiration.",
    badge: "Free",
    cta: "Open Oracle →",
    href: "/oracle",
    cardGradient: "linear-gradient(135deg, rgba(243,193,58,0.62) 0%, rgba(138,90,223,0.74) 48%, rgba(47,35,101,0.98) 100%)",
    overlayGradient: "linear-gradient(180deg, rgba(21,15,36,0.08) 0%, rgba(21,15,36,0.30) 100%)",
    iconGradient: "linear-gradient(135deg, #fbbf24 0%, #e879f9 100%)",
    kind: "oracle",
  },
];

function ProductCardIcon({ kind, iconGradient }: { kind: string; iconGradient: string }) {
  if (kind === "poju") {
    return (
      <span
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 shadow-[0_0_14px_rgba(217,70,239,0.32)]"
        style={{ backgroundImage: iconGradient }}
      >
        <span className="h-5 w-5 rounded-full border border-white/75" />
        <span className="absolute h-2 w-2 rounded-full bg-white" />
      </span>
    );
  }

  if (kind === "syncro") {
    return (
      <span
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-[11px] border border-white/30 shadow-[0_0_14px_rgba(34,211,238,0.3)]"
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
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-[11px] border border-white/30 shadow-[0_0_14px_rgba(232,121,249,0.32)]"
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

const promiseItems = [
  ["No Sign Up", "We don't require an account or personal info."],
  ["Privacy First", "All data stays only on your device."],
  ["Yours Only", "Your sessions, your answers, your control."],
];

const elements = [
  ["✦ ANCIENT", "Two thousand years of Eastern observation: Daoism · Feng Shui · Bazi · Yi Jing"],
  ["✦ MODERN", "Reinforced by science: magnetic fields · spatial cognition · circadian rhythms · environmental psych"],
  ["✦ AI AGENT", "Translated by an intelligence trained on both — into what you can do, today."],
  ["✦ YOU", "Your birth chart. Your direction. Your question. Your this exact moment."],
];

const scienceItems = [
  "✦ Magnetic fields affect cognition — [Journal / Year]",
  "✦ Spatial orientation shapes decisions — [Journal / Year]",
  "✦ Circadian cycles drive biology — [Journal / Year]",
  "✦ Visual direction influences focus — [Journal / Year]",
];

const threeNevers = [
  [
    "✦ Never stored",
    "Your conversations live only on your device. We encrypt them locally. We cannot read them. No one can.",
  ],
  [
    "✦ Never required",
    "No account. No login. No password. No email, unless you want your reading as a PDF.",
  ],
  [
    "✦ Never manipulative",
    "No dark patterns. No fake urgency. No \"limited time.\" No upsells. One price: $9.99 when you need it.",
  ],
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
      <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
        <section>
          <header className="px-1 py-2.5 sm:py-3 md:px-2">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-gradient-to-br from-purple-primary to-purple-pink" />
                <span className="text-sm font-semibold tracking-[0.09em] text-text-primary">POJU</span>
              </Link>
              <nav className="hidden items-center gap-7 text-[11px] uppercase tracking-[0.14em] text-text-secondary md:flex">
                <Link href="/poju" className="hover:text-text-primary">POJU 破局</Link>
                <Link href="/syncro" className="hover:text-text-primary">POJU SYNCRO</Link>
                <Link href="/oracle" className="hover:text-text-primary">POJU ORACLE</Link>
                <Link href="/archive" className="hover:text-text-primary">THE ARCHIVE</Link>
              </nav>
              <Link href="/poju" className="rounded-full border border-purple-vivid/35 bg-purple-primary/35 px-3 py-1 text-[10px] text-text-primary sm:px-4 sm:py-1.5 sm:text-[11px]">
                Get PoJU
              </Link>
            </div>
          </header>

          <div className="relative overflow-hidden pb-8 pt-8 sm:pb-10 sm:pt-10 md:pb-14 md:pt-14">
            <HeroSpline className="pointer-events-none absolute -top-16 left-0 right-0 h-[430px] opacity-75 sm:-top-20 sm:h-[520px] md:-top-28 md:h-[660px]" />
            <div className="relative z-10 mx-auto grid min-h-[360px] w-full max-w-6xl items-center gap-8 sm:min-h-[420px] md:min-h-[520px] md:grid-cols-[1fr]">
              <div className="text-center">
                <h1 className="text-[36px] font-semibold leading-[1.06] text-text-primary sm:text-[44px] md:text-[56px] lg:text-[62px]">
                  Ancient Wisdom,
                  <br />
                  <span className="bg-gradient-to-r from-[#7EEBFF] to-[#55E6FF] bg-clip-text text-transparent">
                    AI-Powered.
                  </span>
                  <br />
                  Made for You.
                </h1>
                <p className="mx-auto mt-4 max-w-[560px] px-2 text-[13px] leading-6 text-[#e6e8f3] sm:text-sm md:px-0 md:text-[15px]">
                  POJU is an AI Agent that combines timeless Eastern wisdom with modern science to help you
                  break through life&apos;s challenges.
                </p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    href="/poju"
                    className="inline-flex w-full max-w-[260px] min-w-[180px] justify-center rounded-full border border-[#7b5cff] bg-[#6d4dff] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(109,77,255,0.42)] hover:bg-[#7a5dff] sm:w-auto"
                  >
                    Start with POJU
                  </Link>
                  <a href="#products" className="poju-button-secondary w-full max-w-[260px] min-w-[160px] justify-center !px-5 !py-2.5 sm:w-auto">
                    Explore Tools
                  </a>
                </div>
              </div>
            </div>

            <div id="products" className="relative mx-auto mt-8 w-full max-w-6xl pt-5">
              <h2 className="text-center text-[31px] font-semibold leading-none text-text-primary sm:text-[34px]">Three Paths, One Purpose</h2>
              <div className="mt-2 text-center text-[12px] leading-5 text-text-dim">
                Explore different dimensions of wisdom.
                <br />
                Find clarity, align your energy, and take action.
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {productCards.map((card, index) => (
                  <article
                    key={card.kind}
                    className={`relative w-full overflow-hidden rounded-[14px] p-4 aspect-[5/3] sm:p-5 ${
                      index === 0 ? "lg:scale-[1.02]" : ""
                    }`}
                  >
                    <div className="absolute inset-0" style={{ backgroundImage: card.cardGradient }} />
                    <div className="absolute inset-0" style={{ backgroundImage: card.overlayGradient }} />
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
                        <Link href={card.href} className="whitespace-nowrap text-[16px] text-text-body hover:text-text-primary">{card.cta}</Link>
                      </div>
                    </div>
                    {card.kind === "syncro" ? <SyncroCardCornerCompass /> : null}
                    {card.kind === "oracle" ? <OracleCardParticleCard /> : null}
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-[#f5f7fc] px-4 py-6 md:px-8">
            <h3 className="text-center text-[28px] font-semibold text-[#202a42] sm:text-[32px] md:text-[36px]">Designed for Real Life</h3>
            <div className="mx-auto mt-5 grid w-full max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {promiseItems.map(([title, desc]) => (
                <article key={title} className="rounded-xl border border-[#e2e7f3] bg-white px-4 py-4 text-center">
                  <div className="mx-auto h-8 w-8 rounded-full border border-[#d2daed] bg-[#f8faff]" />
                  <p className="mt-2 text-sm font-semibold text-[#1f2a44]">{title}</p>
                  <p className="mt-1 text-[12px] leading-5 text-[#6c7690]">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="poju-glass-card mx-auto mt-6 w-full max-w-6xl p-5 sm:p-6 md:p-8">
          <p className="poju-kicker">Where two truths meet.</p>
          <div className="mt-4 space-y-3">
            {elements.map(([title, text]) => (
              <article key={title} className="rounded-lg border border-glass-border/70 bg-black/20 p-4">
                <p className="text-sm font-semibold tracking-[0.08em] text-text-primary">{title}</p>
                <div className="my-2 h-px w-full bg-gradient-to-r from-transparent via-purple-vivid/45 to-transparent" />
                <p className="text-sm text-text-secondary">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="poju-glass-card mx-auto mt-6 w-full max-w-6xl p-5 sm:p-6 md:p-8">
          <h2 className="poju-section-title">What Eastern traditions observed, science is beginning to measure.</h2>
          <ul className="mt-5 space-y-3">
            {scienceItems.map((item) => (
              <li key={item} className="rounded-lg border border-glass-border/70 bg-black/20 px-4 py-3 text-sm text-text-secondary">
                {item}
              </li>
            ))}
          </ul>
          <div className="my-4 h-px w-full bg-gradient-to-r from-transparent via-glass-border to-transparent" />
          <p className="text-sm text-text-secondary">Eastern traditions named these forces two thousand years ago.</p>
          <p className="mt-2 text-sm tracking-[0.16em] text-text-accent">QI · XUAN · BAZI · YUAN</p>
          <p className="mt-3 text-sm text-text-secondary">
            POJU uses AI to translate both languages into something
            <br />
            you can act on — today.
          </p>
        </section>

        <section className="poju-glass-card mx-auto mt-6 w-full max-w-6xl p-5 sm:p-6 md:p-8">
          <h2 className="poju-section-title">Three promises we don&apos;t break.</h2>
          <div className="mt-4 space-y-3">
            {threeNevers.map(([title, text]) => (
              <article key={title} className="rounded-lg border border-glass-border/70 bg-black/20 p-4">
                <p className="font-semibold text-text-primary">{title}</p>
                <p className="mt-2 text-sm text-text-secondary">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="poju-glass-card mx-auto mt-6 w-full max-w-6xl p-5 sm:p-6 md:p-8">
          <p className="poju-kicker">How we actually keep our word.</p>
          <h2 className="mt-2 text-xl font-semibold text-text-primary">Privacy isn&apos;t a checkbox. It&apos;s our architecture.</h2>
          <div className="mt-5 space-y-4">
            {protectItems.map((item) => (
              <article key={item.title} className="rounded-lg border border-glass-border/70 bg-black/20 p-4">
                <p className="font-semibold text-text-primary">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{item.body}</p>
                <p className="mt-2 text-xs italic text-text-dim">{item.verify}</p>
              </article>
            ))}
          </div>
          <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-glass-border to-transparent" />
          <p className="text-sm leading-6 text-text-secondary">
            We&apos;re not a company that sells data because we don&apos;t
            <br />
            collect data. We&apos;re a company that sells one thing:
            <br />
            a $9.99 conversation that helps you move through what&apos;s
            <br />
            stuck. That&apos;s the whole business model.
          </p>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            If you ever doubt us: every claim on this page can be
            <br />
            verified in a minute with your browser&apos;s DevTools or
            <br />
            Anthropic&apos;s public documentation.
          </p>
          <Link href="/privacy" className="mt-4 inline-block text-sm text-text-accent hover:text-purple-vivid">
            Read our full Privacy Policy →
          </Link>
        </section>

        <section className="poju-cosmic-panel mx-auto mt-6 w-full max-w-6xl p-6 sm:p-8 text-center">
          <h2 className="text-[30px] font-semibold text-text-primary sm:text-3xl">Ready to break through?</h2>
          <p className="mt-2 text-sm text-text-secondary">One question. $9.99. Delivered in one conversation.</p>
          <Link href="/poju" className="poju-button-primary mt-5">
            Ask Your Question →
          </Link>
        </section>

        <footer className="mx-auto mt-8 w-full max-w-6xl rounded-xl border border-glass-border bg-bg-layer-1/60 p-6">
          <div className="text-center">
            <p className="text-lg font-semibold tracking-[0.12em] text-text-primary">POJU</p>
            <p className="mt-1 text-sm text-text-secondary">pojulife.com</p>
          </div>
          <div className="my-4 h-px bg-gradient-to-r from-transparent via-glass-border to-transparent" />
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-text-secondary">
            <Link href="/disclaimer" className="hover:text-text-primary">Disclaimer</Link>
            <Link href="/privacy" className="hover:text-text-primary">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-text-primary">Terms of Service</Link>
            <Link href="/contact" className="hover:text-text-primary">Contact</Link>
          </div>
          <p className="mt-4 text-center text-xs text-text-dim">© 2026 POJU. All rights reserved.</p>
          <p className="mt-2 text-center text-xs text-text-dim">
            Not medical, legal, or financial advice. Consult licensed professionals for those matters.
          </p>
        </footer>
      </div>
    </main>
  );
}
