import Link from "next/link";
import type { ReactNode } from "react";

import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { OracleProductHero } from "@/components/marketing/oracle-product-hero";
import { PojuMarkLogo } from "@/components/marketing/poju-mark-logo";

const appendixNarrative = [
  "Across the East, for two thousand years, people came with a single question, held in silence, carried in a sincere heart. They did not ask for advice. They did not expect words. They offered their question to an ancient presence — one said to listen to every soul who came with true intent — and waited for the answer to arrive in a different form.",
  "Not a voice. A sign. A mysterious card, drawn from one hundred archetypal patterns refined over millennia. The answer was never prescriptive. It was revelatory — it showed you what you already carried, now named, now visible.",
  "The only requirement was sincerity. A sincere heart opens the channel. Casual curiosity receives only noise. A real question, held honestly, receives a real sign.",
  "Today, we bring this practice into your hand. The pattern library is intact. The ritual is intact. What changed is only the medium — an AI that reads the drawn sign, understands your question, and delivers the guidance in language you can act on today. The AI is a modern translator of the pattern, not the listening presence itself.",
] as const;

const whenOracleScenarios = [
  {
    title: "You're holding one question that keeps circling back",
    body: "One thread that will not let go — not five topics at once.",
  },
  {
    title: "You don't need an answer — you need a sign",
    body: "You are not looking for a checklist. You are looking for a direction you can feel.",
  },
  {
    title: "You want to listen before you speak",
    body: "You are willing to pause, compress the question, and receive before you decide.",
  },
  {
    title: "You're at a threshold and unsure which side you're on",
    body: "A doorway moment where a single image can name what you already sense.",
  },
] as const;

const oracleVsPojuRows: { label: string; oracle: string; poju: string }[] = [
  { label: "Time", oracle: "~2 minutes", poju: "30 minutes – hours" },
  { label: "Depth", oracle: "One sign, one revelation", poju: "Full breakthrough path" },
  { label: "Price", oracle: "Free", poju: "$9.99 per session" },
  {
    label: "Best when you need",
    oracle: "Direction from a sign",
    poju: "A complete plan to break the deadlock",
  },
] as const;

/** 风向系 5 级（产品页预告文案） */
const windSignLevels = [
  {
    name: "Divine Tailwind",
    lines: [
      "The rare grace of full alignment.",
      "Everything you need is already moving toward you.",
    ],
  },
  {
    name: "Fair Sky",
    lines: [
      "Clear paths with gentle support.",
      "The way is open, but you must still walk it.",
    ],
  },
  {
    name: "Still Water",
    lines: [
      "The time for patience and stillness.",
      "Neither forward nor backward.",
      "Sit with what is.",
    ],
  },
  {
    name: "Crosswind",
    lines: [
      "Competing forces are pulling at you.",
      "This is not a sign to push harder.",
      "It's a sign to listen more carefully.",
    ],
  },
  {
    name: "Eye of Storm",
    lines: [
      "The deep stillness found at the center of a storm.",
      "When everything external is turbulent,",
      "clarity lives in the one place nothing can reach.",
    ],
  },
] as const;

const usageTips = [
  "One question per reading. Don't ask many things at once.",
  "Wait 48 hours before asking the same thing again. Answers need time to settle.",
  "Compress your question into 60 characters. The compression is the beginning of the answer.",
] as const;

function SectionShell({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`mx-auto w-full max-w-3xl px-4 py-10 md:px-6 md:py-12 ${className}`}
    >
      {children}
    </section>
  );
}

export default function OraclePage() {
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
              <Link href="/syncro" className="hover:text-text-primary">
                POJU SYNCRO
              </Link>
              <Link href="/oracle" className="text-text-primary">
                POJU ORACLE
              </Link>
              <Link href="/archive" className="hover:text-text-primary">
                THE ARCHIVE
              </Link>
            </nav>
            <MarketingLanguageSwitcher />
          </div>
        </header>

        <OracleProductHero />

        <SectionShell id="oracle-enter" className="scroll-mt-28">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200/85">
            The Oracle
          </p>
          <h2 className="mt-3 text-center text-[26px] font-semibold leading-tight text-text-primary sm:text-[30px] md:text-[32px]">
            What Oracle is
          </h2>
          <p className="mx-auto mt-2 text-center text-sm italic text-text-secondary sm:text-base">
            A 2,000-year practice of sincere questioning.
          </p>
          <div className="mt-10 space-y-6 text-[15px] leading-8 text-text-secondary sm:text-base sm:leading-9">
            {appendixNarrative.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            <p className="text-center text-[15px] font-medium italic leading-8 text-text-primary sm:text-base">
              One question. One sign. One thing to do.
              <br />
              Bring your sincere heart. The rest follows.
            </p>
          </div>
        </SectionShell>

        <SectionShell id="when-oracle" className="border-t border-white/6 bg-black/10">
          <h2 className="text-center text-[24px] font-semibold text-text-primary sm:text-[28px] md:text-[30px]">
            When Oracle is the right fit
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-7 text-text-secondary sm:text-[15px] sm:leading-8">
            Not every kind of confusion belongs here. These moments match the practice best.
          </p>
          <ul className="mx-auto mt-10 max-w-2xl space-y-8">
            {whenOracleScenarios.map((item) => (
              <li key={item.title}>
                <p className="text-[16px] font-semibold tracking-[0.04em] text-text-primary sm:text-lg">
                  <span className="text-fuchsia-300">✦</span> {item.title}
                </p>
                <p className="mt-2 text-[15px] leading-8 text-text-secondary sm:text-base sm:leading-8">{item.body}</p>
              </li>
            ))}
          </ul>
        </SectionShell>

        <SectionShell id="oracle-poju-compare" className="border-t border-white/6">
          <h2 className="text-center text-[24px] font-semibold text-text-primary sm:text-[28px] md:text-[30px]">
            Oracle and POJU — how to choose
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-7 text-text-secondary sm:text-[15px]">
            Same lineage of care, different depth and pace.
          </p>
          <div className="mt-10 overflow-x-auto rounded-xl border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm sm:text-[15px]" aria-label="Oracle compared to POJU">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-text-dim sm:text-xs">
                  <th className="px-4 py-3 font-medium sm:px-5 sm:py-4" scope="col" />
                  <th className="px-4 py-3 font-medium text-fuchsia-200 sm:px-5 sm:py-4" scope="col">
                    Oracle
                  </th>
                  <th className="px-4 py-3 font-medium text-purple-vivid sm:px-5 sm:py-4" scope="col">
                    POJU
                  </th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                {oracleVsPojuRows.map((row) => (
                  <tr key={row.label} className="border-b border-white/5 last:border-0">
                    <th className="px-4 py-3.5 font-medium text-text-primary sm:px-5 sm:py-4" scope="row">
                      {row.label}
                    </th>
                    <td className="px-4 py-3.5 sm:px-5 sm:py-4">{row.oracle}</td>
                    <td className="px-4 py-3.5 sm:px-5 sm:py-4">{row.poju}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionShell>

        <SectionShell id="five-winds" className="border-t border-white/6 bg-black/10">
          <h2 className="text-center text-[24px] font-semibold text-text-primary sm:text-[28px] md:text-[30px]">
            Five winds — five kinds of signs
          </h2>
          <p className="mx-auto mt-4 text-center text-sm leading-7 text-text-secondary sm:text-[15px] sm:leading-8">
            Guidance is channeled through five master signs, each encompassing a multitude of deeper meanings. Guided
            by ancient Eastern wisdom, the Oracle identifies and unveils the single most direct response tailored to
            the essence of your question.
          </p>
          <ul className="mx-auto mt-10 max-w-2xl space-y-10 text-left">
            {windSignLevels.map((level) => (
              <li key={level.name} className="border-b border-white/[0.06] pb-10 last:border-0 last:pb-0">
                <p className="text-[16px] font-semibold tracking-[0.02em] text-text-primary sm:text-lg">
                  <span className="text-fuchsia-300">✦</span> {level.name}
                </p>
                <div className="mt-3 space-y-2 text-[15px] leading-8 text-text-secondary sm:text-base sm:leading-8">
                  {level.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-10 max-w-xl text-center text-sm italic leading-7 text-text-secondary sm:text-[15px] sm:leading-8">
            Which one calls for you today depends on the question you bring and the sincerity you hold.
          </p>
        </SectionShell>

        <SectionShell id="oracle-guidelines" className="border-t border-white/6">
          <h2 className="text-center text-[24px] font-semibold text-text-primary sm:text-[28px] md:text-[30px]">
            Before you start
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-text-dim sm:text-[15px]">
            Read these once — they shape the quality of what you receive.
          </p>
          <ul className="mx-auto mt-8 max-w-2xl space-y-4 rounded-xl border border-white/10 bg-black/25 p-5 sm:p-6">
            {usageTips.map((tip) => (
              <li key={tip} className="text-[15px] leading-8 text-text-secondary sm:text-base sm:leading-8">
                <span className="mr-2 text-fuchsia-200">◉</span>
                {tip}
              </li>
            ))}
          </ul>
        </SectionShell>

        <section
          id="oracle-final-cta"
          className="mx-auto mt-4 w-full max-w-3xl scroll-mt-24 px-4 pb-6 pt-12 text-center md:px-6 md:pb-8 md:pt-14"
        >
          <div className="rounded-2xl border border-fuchsia-400/20 bg-gradient-to-b from-fuchsia-950/30 to-black/40 px-6 py-12 sm:px-10 sm:py-14">
            <h2 className="text-[22px] font-semibold text-text-primary sm:text-[26px]">Ready for your sign?</h2>
            <div className="mt-8 flex flex-col items-center gap-4 sm:mt-10">
              <Link
                href="/oracle/stage-1"
                className="inline-flex w-full min-w-[220px] max-w-sm justify-center rounded-full border border-fuchsia-300/55 bg-fuchsia-500/30 px-8 py-3.5 text-[15px] font-semibold text-fuchsia-50 shadow-[0_10px_28px_rgba(217,70,239,0.35)] hover:bg-fuchsia-400/35 sm:w-auto md:px-10 md:py-4 md:text-base"
              >
                Start Your Oracle →
              </Link>
              <Link
                href="/poju#oracle-vs-poju"
                className="text-sm font-medium text-text-secondary underline-offset-4 transition hover:text-fuchsia-200 hover:underline sm:text-[15px]"
              >
                Still unsure? Learn how Oracle compares to POJU →
              </Link>
            </div>
            <p className="mt-8 text-xs leading-6 text-text-dim sm:text-sm">
              Always free. No account. Your sign is yours alone.
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
