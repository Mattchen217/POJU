import Link from "next/link";
import type { ReactNode } from "react";

import { MarketingLanguageSwitcher } from "@/components/marketing/marketing-language-switcher";
import { OracleProductHero } from "@/components/marketing/oracle-product-hero";
import { PojuMarkLogo } from "@/components/marketing/poju-mark-logo";
import { WindCardWithParticles } from "@/components/oracle/wind-cards";
import crosswind from "@/assets/images/crosswind.png";
import divineTailwind from "@/assets/images/divine tailwind.png";
import eyeOfStorm from "@/assets/images/eye of storm.png";
import fairSky from "@/assets/images/fair sky.png";
import stillWater from "@/assets/images/still water.png";

const appendixNarrative = [
  "Across the East, for two thousand years, people came with a single question, held in silence, carried in a sincere heart. They did not ask for advice. They did not expect words. They offered their question to an ancient presence — one said to listen to every soul who came with true intent — and waited for the answer to arrive in a different form.",
  "Not a voice. A pattern. A card drawn from one hundred archetypal forms refined over millennia. The answer is not prescriptive - it describes what you already carry, now named and visible.",
  "The only requirement is sincerity. Casual curiosity receives noise. A real question, held honestly, receives a clearer reflection.",
  "Today, we bring this practice into your hand. The pattern library is intact. What changed is only the medium - an AI that reads the drawn pattern, understands your question, and delivers context you can act on today.",
] as const;

const glyphFitScenarios = [
  {
    title: "You're holding one question that keeps circling back",
    body: "One thread that will not let go — not five topics at once.",
  },
  {
    title: "You don't need an answer - you need a mirror",
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

const glyphVsPojuRows: { label: string; glyph: string; poju: string }[] = [
  { label: "Time", glyph: "~2 minutes", poju: "30 minutes – hours" },
  { label: "Depth", glyph: "One pattern, one perspective", poju: "Full breakthrough path" },
  { label: "Price", glyph: "Free", poju: "$9.99 per session" },
  {
    label: "Best when you need",
    glyph: "Direction from a pattern",
    poju: "A complete plan to break the deadlock",
  },
] as const;

/** 风向系 5 级（产品页预告文案） */
const windSignLevels = [
  {
    name: "Divine Tailwind",
    particleKey: "divine-tailwind",
    image: divineTailwind,
    imageAlt: "Divine Tailwind card art",
    lines: [
      "The rare grace of full alignment.",
      "Everything you need is already moving toward you.",
    ],
  },
  {
    name: "Fair Sky",
    particleKey: "fair-sky",
    image: fairSky,
    imageAlt: "Fair Sky card art",
    lines: [
      "Clear paths with gentle support.",
      "The way is open, but you must still walk it.",
    ],
  },
  {
    name: "Still Water",
    particleKey: "still-water",
    image: stillWater,
    imageAlt: "Still Water card art",
    lines: [
      "The time for patience and stillness.",
      "Neither forward nor backward.",
      "Sit with what is.",
    ],
  },
  {
    name: "Crosswind",
    particleKey: "crosswind",
    image: crosswind,
    imageAlt: "Crosswind card art",
    lines: [
      "Competing forces are pulling at you.",
      "This is not a cue to push harder.",
      "It's a cue to listen more carefully.",
    ],
  },
  {
    name: "Eye of Storm",
    particleKey: "eye-of-storm",
    image: eyeOfStorm,
    imageAlt: "Eye of Storm card art",
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
              <Link href="/glyph" className="text-text-primary">
                POJU GLYPH
              </Link>
              <Link href="/archive" className="hover:text-text-primary">
                THE ARCHIVE
              </Link>
            </nav>
            <MarketingLanguageSwitcher />
          </div>
        </header>

        <OracleProductHero />

        <SectionShell id="glyph-enter" className="scroll-mt-28">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200/85">
            The Glyph
          </p>
          <h2 className="mt-3 text-center text-[26px] font-semibold leading-tight text-text-primary sm:text-[30px] md:text-[32px]">
            What Glyph is
          </h2>
          <p className="mx-auto mt-2 text-center text-sm italic text-text-secondary sm:text-base">
            A 60-second reflection practice.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-8 text-text-secondary">
            Hold a question. Draw one of 100 archetypal patterns refined over a thousand years of
            human reflection. Receive a structured response from AI - grounded in wisdom traditions,
            decision psychology, and behavioral economics.
          </p>
          <p className="mt-2 text-center text-sm text-text-dim">
            Free · No signup · Read with a wink
          </p>
          <div className="mt-10 space-y-6 text-[15px] leading-8 text-text-secondary sm:text-base sm:leading-9">
            {appendixNarrative.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            <p className="text-center text-[15px] font-medium italic leading-8 text-text-primary sm:text-base">
            One question. One pattern. One next step.
              <br />
              Read with a wink. Decisions are yours alone.
            </p>
          </div>
        </SectionShell>

        <SectionShell id="when-glyph" className="border-t border-white/6 bg-black/10">
          <h2 className="text-center text-[24px] font-semibold text-text-primary sm:text-[28px] md:text-[30px]">
            When Glyph is the right fit
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-7 text-text-secondary sm:text-[15px] sm:leading-8">
            Not every kind of confusion belongs here. These moments match the practice best.
          </p>
          <ul className="mx-auto mt-10 max-w-2xl space-y-8">
            {glyphFitScenarios.map((item) => (
              <li key={item.title}>
                <p className="text-[16px] font-semibold tracking-[0.04em] text-text-primary sm:text-lg">
                  <span className="text-fuchsia-300">✦</span> {item.title}
                </p>
                <p className="mt-2 text-[15px] leading-8 text-text-secondary sm:text-base sm:leading-8">{item.body}</p>
              </li>
            ))}
          </ul>
        </SectionShell>

        <SectionShell id="glyph-poju-compare" className="border-t border-white/6">
          <h2 className="text-center text-[24px] font-semibold text-text-primary sm:text-[28px] md:text-[30px]">
            Glyph and POJU — how to choose
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-7 text-text-secondary sm:text-[15px]">
            Same lineage of care, different depth and pace.
          </p>
          <div className="mt-10 overflow-x-auto rounded-xl border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm sm:text-[15px]" aria-label="Glyph compared to POJU">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-text-dim sm:text-xs">
                  <th className="px-4 py-3 font-medium sm:px-5 sm:py-4" scope="col" />
                  <th className="px-4 py-3 font-medium text-fuchsia-200 sm:px-5 sm:py-4" scope="col">
                    Glyph
                  </th>
                  <th className="px-4 py-3 font-medium text-purple-vivid sm:px-5 sm:py-4" scope="col">
                    POJU
                  </th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                {glyphVsPojuRows.map((row) => (
                  <tr key={row.label} className="border-b border-white/5 last:border-0">
                    <th className="px-4 py-3.5 font-medium text-text-primary sm:px-5 sm:py-4" scope="row">
                      {row.label}
                    </th>
                    <td className="px-4 py-3.5 sm:px-5 sm:py-4">{row.glyph}</td>
                    <td className="px-4 py-3.5 sm:px-5 sm:py-4">{row.poju}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionShell>

        <SectionShell id="five-winds" className="border-t border-white/6 bg-black/10">
          <h2 className="text-center text-[24px] font-semibold text-text-primary sm:text-[28px] md:text-[30px]">
            Five winds — five archetypal patterns
          </h2>
          <p className="mx-auto mt-4 text-center text-sm leading-7 text-text-secondary sm:text-[15px] sm:leading-8">
            The five patterns are mirrors, not predictions. Each one describes a human situation and helps
            you frame what is already happening.
          </p>
          <p className="mx-auto mt-5 text-center text-xs text-text-dim">
            <Link href="/five-wind-cards" className="text-cyan-bright/90 underline-offset-2 hover:underline">
              查看五张卡面
            </Link>
            <span className="text-text-dim">（/five-wind-cards）</span>
          </p>
          <div className="mx-auto mt-10 max-w-6xl">
            {(() => {
              const divine = windSignLevels.find((x) => x.name === "Divine Tailwind");
              const fair = windSignLevels.find((x) => x.name === "Fair Sky");
              const still = windSignLevels.find((x) => x.name === "Still Water");
              const cross = windSignLevels.find((x) => x.name === "Crosswind");
              const eye = windSignLevels.find((x) => x.name === "Eye of Storm");
              if (!divine || !fair || !still || !cross || !eye) return null;

              return (
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:grid-rows-3 lg:gap-x-10 lg:gap-y-10">
                  <div className="flex items-center justify-center gap-3 lg:col-start-1 lg:row-start-1 lg:justify-start">
                    <div className="w-full max-w-[96px] shrink-0">
                      <WindCardWithParticles
                        src={divine.image}
                        alt={divine.imageAlt}
                        particleKey={divine.particleKey}
                        sizes="96px"
                        priority
                      />
                    </div>
                    <div className="max-w-[360px] text-center lg:text-left">
                      <p className="whitespace-nowrap text-[17px] font-semibold leading-tight tracking-[0.01em] text-text-primary sm:text-[18px]">
                        {divine.name}
                      </p>
                      <div className="mt-1 space-y-0.5 text-[12px] leading-5 text-text-secondary sm:text-[13px] sm:leading-5">
                        {divine.lines.map((line) => (
                          <p key={line} className="whitespace-nowrap">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 lg:col-start-1 lg:row-start-2 lg:justify-start">
                    <div className="w-full max-w-[96px] shrink-0">
                      <WindCardWithParticles
                        src={still.image}
                        alt={still.imageAlt}
                        particleKey={still.particleKey}
                        sizes="96px"
                      />
                    </div>
                    <div className="max-w-[360px] text-center lg:text-left">
                      <p className="whitespace-nowrap text-[17px] font-semibold leading-tight tracking-[0.01em] text-text-primary sm:text-[18px]">
                        {still.name}
                      </p>
                      <div className="mt-1 space-y-0.5 text-[12px] leading-5 text-text-secondary sm:text-[13px] sm:leading-5">
                        {still.lines.map((line) => (
                          <p key={line} className="whitespace-nowrap">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 lg:col-start-1 lg:row-start-3 lg:justify-start">
                    <div className="w-full max-w-[96px] shrink-0">
                      <WindCardWithParticles
                        src={eye.image}
                        alt={eye.imageAlt}
                        particleKey={eye.particleKey}
                        sizes="96px"
                      />
                    </div>
                    <div className="max-w-[360px] text-center lg:text-left">
                      <p className="whitespace-nowrap text-[17px] font-semibold leading-tight tracking-[0.01em] text-text-primary sm:text-[18px]">
                        {eye.name}
                      </p>
                      <div className="mt-1 space-y-0.5 text-[12px] leading-5 text-text-secondary sm:text-[13px] sm:leading-5">
                        {eye.lines.map((line) => (
                          <p key={line} className="whitespace-nowrap">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center lg:justify-end">
                    <div className="max-w-[360px] text-center lg:text-right">
                      <p className="whitespace-nowrap text-[17px] font-semibold leading-tight tracking-[0.01em] text-text-primary sm:text-[18px]">
                        {fair.name}
                      </p>
                      <div className="mt-1 space-y-0.5 text-[12px] leading-5 text-text-secondary sm:text-[13px] sm:leading-5">
                        {fair.lines.map((line) => (
                          <p key={line} className="whitespace-nowrap">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="w-full max-w-[96px] shrink-0">
                      <WindCardWithParticles
                        src={fair.image}
                        alt={fair.imageAlt}
                        particleKey={fair.particleKey}
                        sizes="96px"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 lg:col-start-2 lg:row-start-2 lg:row-span-2 lg:self-center lg:justify-end">
                    <div className="max-w-[360px] text-center lg:text-right">
                      <p className="whitespace-nowrap text-[17px] font-semibold leading-tight tracking-[0.01em] text-text-primary sm:text-[18px]">
                        {cross.name}
                      </p>
                      <div className="mt-1 space-y-0.5 text-[12px] leading-5 text-text-secondary sm:text-[13px] sm:leading-5">
                        {cross.lines.map((line) => (
                          <p key={line} className="whitespace-nowrap">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="w-full max-w-[96px] shrink-0">
                      <WindCardWithParticles
                        src={cross.image}
                        alt={cross.imageAlt}
                        particleKey={cross.particleKey}
                        sizes="96px"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="mx-auto mt-10 max-w-xl space-y-4 text-center text-sm leading-7 text-text-secondary sm:text-[15px] sm:leading-8">
            <p className="font-semibold uppercase tracking-[0.08em] text-text-primary">On the cards</p>
            <p>
              The five glyphs are not labels of fortune.
              <br />
              They are not &quot;good cards&quot; or &quot;bad cards.&quot;
            </p>
            <p>
              Each one is a lens - a way of reading this particular moment, for this particular question, held by this
              particular person.
            </p>
            <p>
              The same glyph can mean entirely different things on different days, for different people, about
              different questions.
            </p>
            <p>
              What you receive is not a verdict.
              <br />
              It is a perspective - and an invitation to look more carefully.
            </p>
          </div>
        </SectionShell>

        <SectionShell id="glyph-guidelines" className="border-t border-white/6">
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

        <SectionShell id="glyph-storage" className="border-t border-white/6 bg-black/10">
          <h2 className="text-center text-[24px] font-semibold text-text-primary sm:text-[28px] md:text-[30px]">
            What we never store
          </h2>
          <ul className="mx-auto mt-8 max-w-2xl space-y-3 text-[15px] leading-8 text-text-secondary sm:text-base">
            <li>- Your question (browser local only)</li>
            <li>- Your name (we never ask)</li>
            <li>- Your IP (anonymized within 24h)</li>
            <li>- Your conversation (after you leave)</li>
          </ul>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-text-dim sm:text-[15px]">
            Free to use. No account. Take what&apos;s useful, leave what isn&apos;t.
          </p>
        </SectionShell>

        <section
          id="glyph-final-cta"
          className="mx-auto mt-4 w-full max-w-3xl scroll-mt-24 px-4 pb-6 pt-12 text-center md:px-6 md:pb-8 md:pt-14"
        >
          <div className="rounded-2xl border border-fuchsia-400/20 bg-gradient-to-b from-fuchsia-950/30 to-black/40 px-6 py-12 sm:px-10 sm:py-14">
            <h2 className="text-[22px] font-semibold text-text-primary sm:text-[26px]">Ready for your Glyph?</h2>
            <div className="mt-8 flex flex-col items-center gap-4 sm:mt-10">
              <Link
                href="/glyph/reading"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full min-w-[220px] max-w-sm justify-center rounded-full border border-fuchsia-300/55 bg-fuchsia-500/30 px-8 py-3.5 text-[15px] font-semibold text-fuchsia-50 shadow-[0_10px_28px_rgba(217,70,239,0.35)] hover:bg-fuchsia-400/35 sm:w-auto md:px-10 md:py-4 md:text-base"
              >
                Start Your Glyph →
              </Link>
              <Link
                href="/poju#glyph-vs-poju"
                className="text-sm font-medium text-text-secondary underline-offset-4 transition hover:text-fuchsia-200 hover:underline sm:text-[15px]"
              >
                Still unsure? Learn how Glyph compares to POJU →
              </Link>
            </div>
            <p className="mt-8 text-xs leading-6 text-text-dim sm:text-sm">
              Read with a wink. The patterns mirror, they don&apos;t predict. Decisions are yours alone.
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
              For reflection and entertainment. POJU does not predict outcomes or replace professional advice.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
