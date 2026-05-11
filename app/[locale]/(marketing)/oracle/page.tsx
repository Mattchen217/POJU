import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Glyph — pojulife",
  description:
    "Where AI meets a thousand years of wisdom. A pocket-sized mirror — hold a question, draw a pattern, read what comes back.",
};

import { OracleProductHero } from "@/components/marketing/oracle-product-hero";
import { WindCardWithParticles, type WindCardParticleKey } from "@/components/oracle/wind-cards";
import crosswind from "@/assets/images/crosswind.png";
import divineTailwind from "@/assets/images/divine tailwind.png";
import eyeOfStorm from "@/assets/images/eye of storm.png";
import fairSky from "@/assets/images/fair sky.png";
import stillWater from "@/assets/images/still water.png";
import { PwaInlineOpenLink } from "@/components/marketing/pwa-inline-open-link";

function linesFromGlyphDescription(description: string): string[] {
  const parts = description
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [description];
}

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
    <section id={id} className={`mx-auto w-full max-w-3xl px-4 py-10 md:px-6 md:py-12 ${className}`}>
      {children}
    </section>
  );
}

export default async function OraclePage() {
  const t = await getTranslations("marketingSite.glyph");
  const tCommon = await getTranslations("marketingSite.common");
  const glyphUsageRules = t.raw("how_it_works.rules") as string[];
  const onTheCardsParagraphs = t.raw("on_the_cards.paragraphs") as string[];

  const heroCopy = {
    heading: t("hero.heading"),
    subtitle: t("hero.subtitle"),
    description: t("hero.description"),
    footnote: t("hero.footnote"),
    cta: t("hero.cta"),
    ctaSubline: t("hero.cta_subline"),
  };

  const divine = {
    particleKey: "divine-tailwind" as WindCardParticleKey,
    image: divineTailwind,
    imageAlt: "Divine Tailwind card art",
    name: t("five_winds.divine_tailwind.name"),
    lines: linesFromGlyphDescription(t("five_winds.divine_tailwind.description")),
  };
  const fair = {
    particleKey: "fair-sky" as WindCardParticleKey,
    image: fairSky,
    imageAlt: "Fair Sky card art",
    name: t("five_winds.fair_sky.name"),
    lines: linesFromGlyphDescription(t("five_winds.fair_sky.description")),
  };
  const still = {
    particleKey: "still-water" as WindCardParticleKey,
    image: stillWater,
    imageAlt: "Still Water card art",
    name: t("five_winds.still_water.name"),
    lines: linesFromGlyphDescription(t("five_winds.still_water.description")),
  };
  const cross = {
    particleKey: "crosswind" as WindCardParticleKey,
    image: crosswind,
    imageAlt: "Crosswind card art",
    name: t("five_winds.crosswind.name"),
    lines: linesFromGlyphDescription(t("five_winds.crosswind.description")),
  };
  const eye = {
    particleKey: "eye-of-storm" as WindCardParticleKey,
    image: eyeOfStorm,
    imageAlt: "Eye of Storm card art",
    name: t("five_winds.eye_of_storm.name"),
    lines: linesFromGlyphDescription(t("five_winds.eye_of_storm.description")),
  };

  return (
    <main className="bg-bg-deep text-text-body">
      <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
        <OracleProductHero copy={heroCopy} />

        <SectionShell id="five-winds" className="max-w-6xl scroll-mt-28">
          <h2 className="text-center text-[24px] font-semibold text-text-primary sm:text-[28px] md:text-[30px]">
            {t("five_winds.heading")}
          </h2>
          <p className="mx-auto mt-4 text-center text-sm leading-7 text-text-secondary sm:text-[15px] sm:leading-8">
            {t("five_winds.description")}
          </p>
          <div className="mx-auto mt-10 max-w-6xl">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:grid-rows-3 lg:gap-x-6 lg:gap-y-16">
              <div className="flex justify-center lg:col-start-1 lg:row-start-1 lg:justify-end lg:pr-1">
                <div className="grid w-full max-w-xl grid-cols-[128px_minmax(0,1fr)] items-center gap-4">
                  <div className="w-full max-w-[128px]">
                    <WindCardWithParticles
                      src={divine.image}
                      alt={divine.imageAlt}
                      particleKey={divine.particleKey}
                      sizes="128px"
                      priority
                    />
                  </div>
                  <div className="min-w-0 text-center lg:text-left">
                    <p className="whitespace-nowrap text-[20px] font-semibold leading-tight tracking-[0.01em] text-text-primary sm:text-[22px] md:text-[23px]">
                      {divine.name}
                    </p>
                    <div className="mt-1.5 space-y-1 text-[14px] leading-6 text-text-secondary sm:text-[15px] sm:leading-7 md:text-[16px] md:leading-7">
                      {divine.lines.map((line) => (
                        <p key={line} className="whitespace-normal break-words sm:whitespace-nowrap">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center lg:col-start-1 lg:row-start-2 lg:justify-end lg:pr-1">
                <div className="grid w-full max-w-xl grid-cols-[128px_minmax(0,1fr)] items-center gap-4">
                  <div className="w-full max-w-[128px]">
                    <WindCardWithParticles
                      src={still.image}
                      alt={still.imageAlt}
                      particleKey={still.particleKey}
                      sizes="128px"
                    />
                  </div>
                  <div className="min-w-0 text-center lg:text-left">
                    <p className="whitespace-nowrap text-[20px] font-semibold leading-tight tracking-[0.01em] text-text-primary sm:text-[22px] md:text-[23px]">
                      {still.name}
                    </p>
                    <div className="mt-1.5 space-y-1 text-[14px] leading-6 text-text-secondary sm:text-[15px] sm:leading-7 md:text-[16px] md:leading-7">
                      {still.lines.map((line) => (
                        <p key={line} className="whitespace-normal break-words sm:whitespace-nowrap">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center lg:col-start-1 lg:row-start-3 lg:justify-end lg:pr-1">
                <div className="grid w-full max-w-xl grid-cols-[128px_minmax(0,1fr)] items-center gap-4">
                  <div className="w-full max-w-[128px]">
                    <WindCardWithParticles
                      src={eye.image}
                      alt={eye.imageAlt}
                      particleKey={eye.particleKey}
                      sizes="128px"
                    />
                  </div>
                  <div className="min-w-0 text-center lg:text-left">
                    <p className="whitespace-nowrap text-[20px] font-semibold leading-tight tracking-[0.01em] text-text-primary sm:text-[22px] md:text-[23px]">
                      {eye.name}
                    </p>
                    <div className="mt-1.5 space-y-1 text-[14px] leading-6 text-text-secondary sm:text-[15px] sm:leading-7 md:text-[16px] md:leading-7">
                      {eye.lines.map((line) => (
                        <p key={line} className="whitespace-normal break-words sm:whitespace-nowrap">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center lg:justify-start lg:pl-1">
                <div className="grid w-full max-w-xl grid-cols-[minmax(0,1fr)_128px] items-center gap-4">
                  <div className="min-w-0 text-center lg:text-right">
                    <p className="whitespace-nowrap text-[20px] font-semibold leading-tight tracking-[0.01em] text-text-primary sm:text-[22px] md:text-[23px]">
                      {fair.name}
                    </p>
                    <div className="mt-1.5 space-y-1 text-[14px] leading-6 text-text-secondary sm:text-[15px] sm:leading-7 md:text-[16px] md:leading-7">
                      {fair.lines.map((line) => (
                        <p key={line} className="whitespace-normal break-words sm:whitespace-nowrap">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="w-full max-w-[128px] justify-self-end">
                    <WindCardWithParticles src={fair.image} alt={fair.imageAlt} particleKey={fair.particleKey} sizes="128px" />
                  </div>
                </div>
              </div>

              <div className="flex justify-center lg:col-start-2 lg:row-start-2 lg:row-span-2 lg:self-center lg:justify-start lg:pl-1">
                <div className="grid w-full max-w-xl grid-cols-[minmax(0,1fr)_128px] items-center gap-4">
                  <div className="min-w-0 text-center lg:text-right">
                    <p className="whitespace-nowrap text-[20px] font-semibold leading-tight tracking-[0.01em] text-text-primary sm:text-[22px] md:text-[23px]">
                      {cross.name}
                    </p>
                    <div className="mt-1.5 space-y-1 text-[14px] leading-6 text-text-secondary sm:text-[15px] sm:leading-7 md:text-[16px] md:leading-7">
                      {cross.lines.map((line) => (
                        <p key={line} className="whitespace-normal break-words sm:whitespace-nowrap">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="w-full max-w-[128px] justify-self-end">
                    <WindCardWithParticles
                      src={cross.image}
                      alt={cross.imageAlt}
                      particleKey={cross.particleKey}
                      sizes="128px"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-12 max-w-xl space-y-4 text-center text-sm leading-7 text-text-secondary sm:text-[15px] sm:leading-8">
            <p className="font-semibold uppercase tracking-[0.08em] text-text-primary">{t("on_the_cards.heading")}</p>
            {onTheCardsParagraphs.map((para) => (
              <p key={para}>{para}</p>
            ))}
          </div>
        </SectionShell>

        <SectionShell id="glyph-how-it-works" className="max-w-6xl">
          <h2 className="text-center text-[24px] font-semibold text-text-primary sm:text-[28px] md:text-[30px]">
            {t("how_it_works.heading")}
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-10 md:grid-cols-3 md:gap-6">
            <div className="text-center">
              <p className="text-4xl font-semibold leading-none text-fuchsia-300/90">1</p>
              <p className="mt-4 text-[16px] font-semibold text-text-primary">{t("how_it_works.step_1.title")}</p>
              <p className="mt-2 text-[14px] leading-7 text-text-secondary sm:text-[15px]">{t("how_it_works.step_1.description")}</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-semibold leading-none text-fuchsia-300/90">2</p>
              <p className="mt-4 text-[16px] font-semibold text-text-primary">{t("how_it_works.step_2.title")}</p>
              <p className="mt-2 text-[14px] leading-7 text-text-secondary sm:text-[15px]">{t("how_it_works.step_2.description")}</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-semibold leading-none text-fuchsia-300/90">3</p>
              <p className="mt-4 text-[16px] font-semibold text-text-primary">{t("how_it_works.step_3.title")}</p>
              <p className="mt-2 text-[14px] leading-7 text-text-secondary sm:text-[15px]">{t("how_it_works.step_3.description")}</p>
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
            {t("how_it_works.session_reminder")}
          </p>
        </SectionShell>

        <section
          id="glyph-final-cta"
          className="poju-cosmic-panel glyph-final-cta-gold-panel mx-auto mt-8 w-full max-w-6xl scroll-mt-24 px-4 py-8 text-center md:mt-10 md:px-8 md:py-10"
        >
          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center">
            <h2 className="text-[30px] font-semibold text-text-primary sm:text-[34px] md:text-[38px]">
              {t("final_cta.heading")}
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-8 text-amber-50/90 sm:text-base">{t("final_cta.subtitle")}</p>
            <PwaInlineOpenLink
              href="/start?next=%2Fglyph%2Freading"
              frameTitle="Glyph"
              closeLabel="关闭"
              className="marketing-pill-outline-cta marketing-pill-outline-cta--amber mt-7 inline-flex w-full min-w-[220px] max-w-sm px-8 py-3.5 text-[15px] hover:-translate-y-0.5 hover:scale-[1.04] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] sm:w-auto md:px-10 md:py-4 md:text-base"
            >
              {t("final_cta.cta")}
            </PwaInlineOpenLink>
            <p className="mt-2 max-w-md text-center text-[12px] leading-5 text-white sm:text-[13px] sm:leading-5 md:text-[14px] md:leading-6">
              {t("final_cta.cta_subline")}
            </p>
            <p className="mt-6 max-w-2xl text-xs leading-6 text-amber-50/75 sm:mt-8 sm:text-sm">{tCommon("read_with_wink")}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
