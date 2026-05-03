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

/** 风向系 5 级（产品页预告文案） */
const glyphUsageRules = [
  "One question per reading. Don't ask many things at once.",
  "Wait 48 hours before asking the same thing again. Answers need time to settle.",
  "Compress your question into 60 characters. The compression is the beginning of the answer.",
] as const;

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
            <nav className="hidden items-center gap-7 text-[12px] tracking-[0.12em] text-text-secondary sm:text-[13px] md:flex md:text-[14px]">
              <Link href="/poju" className="hover:text-text-primary">
                POJU
              </Link>
              <Link href="/glyph" className="text-text-primary">
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

        <OracleProductHero />

        <SectionShell id="five-winds" className="max-w-6xl scroll-mt-28 border-t border-white/6 bg-black/10">
          <h2 className="text-center text-[24px] font-semibold text-text-primary sm:text-[28px] md:text-[30px]">
            Five winds — five archetypal patterns
          </h2>
          <p className="mx-auto mt-4 text-center text-sm leading-7 text-text-secondary sm:text-[15px] sm:leading-8">
            The five patterns are mirrors, not predictions. Each one describes a human situation and helps you frame what is
            already happening.
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
          <div className="mx-auto mt-12 max-w-xl space-y-4 text-center text-sm leading-7 text-text-secondary sm:text-[15px] sm:leading-8">
            <p className="font-semibold uppercase tracking-[0.08em] text-text-primary">On the cards.</p>
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
              The same glyph can mean entirely different things on different days, for different people, about different
              questions.
            </p>
            <p>
              What you receive is not a verdict.
              <br />
              It is a perspective - and an invitation to look more carefully.
            </p>
          </div>
        </SectionShell>

        <SectionShell id="glyph-how-it-works" className="max-w-6xl border-t border-white/6">
          <h2 className="text-center text-[24px] font-semibold text-text-primary sm:text-[28px] md:text-[30px]">
            How Glyph works.
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-10 md:grid-cols-3 md:gap-6">
            <div className="text-center">
              <p className="text-4xl font-semibold leading-none text-fuchsia-300/90">1</p>
              <p className="mt-4 text-[16px] font-semibold text-text-primary">Hold your question.</p>
              <p className="mt-2 text-[14px] leading-7 text-text-secondary sm:text-[15px]">
                Compress it to 60 characters. The compression begins the answer.
              </p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-semibold leading-none text-fuchsia-300/90">2</p>
              <p className="mt-4 text-[16px] font-semibold text-text-primary">Draw your pattern.</p>
              <p className="mt-2 text-[14px] leading-7 text-text-secondary sm:text-[15px]">
                One of 100 archetypal forms, refined over a thousand years.
              </p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-semibold leading-none text-fuchsia-300/90">3</p>
              <p className="mt-4 text-[16px] font-semibold text-text-primary">Read your reflection.</p>
              <p className="mt-2 text-[14px] leading-7 text-text-secondary sm:text-[15px]">
                A short response — grounded in wisdom traditions and modern psychology.
              </p>
            </div>
          </div>
          <ul className="mx-auto mt-10 max-w-2xl space-y-3 rounded-xl border border-white/10 bg-black/25 p-5 text-left sm:p-6">
            {glyphUsageRules.map((rule) => (
              <li key={rule} className="text-[14px] leading-8 text-text-secondary sm:text-[15px] sm:leading-8">
                <span className="mr-2 text-fuchsia-200">◉</span>
                {rule}
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-8 max-w-xl text-center text-sm leading-7 text-text-dim sm:text-[15px]">
            One question per session. If the same question calls you back, wait 48 hours.
          </p>
        </SectionShell>

        <section
          id="glyph-final-cta"
          className="mx-auto mt-4 w-full max-w-3xl scroll-mt-24 px-4 pb-6 pt-12 text-center md:px-6 md:pb-8 md:pt-14"
        >
          <div className="rounded-2xl border border-fuchsia-400/20 bg-gradient-to-b from-fuchsia-950/30 to-black/40 px-6 py-12 sm:px-10 sm:py-14">
            <h2 className="text-[22px] font-semibold text-text-primary sm:text-[26px]">Hold one question.</h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-8 text-text-secondary">
              What you receive is not a verdict. It is an invitation to look more carefully.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:mt-10">
              <Link
                href="/glyph/reading"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full min-w-[220px] max-w-sm justify-center rounded-full border border-fuchsia-300/55 bg-fuchsia-500/30 px-8 py-3.5 text-[15px] font-semibold text-fuchsia-50 shadow-[0_10px_28px_rgba(217,70,239,0.35)] hover:bg-fuchsia-400/35 sm:w-auto md:px-10 md:py-4 md:text-base"
              >
                Try Glyph — Free
              </Link>
            </div>
            <p className="mt-8 text-xs leading-6 text-text-dim sm:text-sm">
              Read with a wink. The patterns mirror, they don&apos;t predict.
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
              For self-reflection and entertainment. POJU offers perspectives, not predictions. All decisions are yours alone.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
