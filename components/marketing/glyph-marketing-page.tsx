import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GlyphPrepareCta } from "@/components/glyph/GlyphPrepareCta";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { PWAProductBeginCTA } from "@/components/pwa/PWAProductBeginCTA";
import {
  MarketingPageHero,
  MarketingPageLayout,
  MarketingPageSections,
} from "@/components/marketing/marketing-page-layout";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { OracleProductHero } from "@/components/marketing/oracle-product-hero";
import { cn } from "@/lib/utils/classnames";
import { WindCardWithParticles, type WindCardParticleKey } from "@/components/oracle/wind-cards";
import crosswind from "@/assets/images/crosswind.png";
import divineTailwind from "@/assets/images/divine tailwind.png";
import eyeOfStorm from "@/assets/images/eye of storm.png";
import fairSky from "@/assets/images/fair sky.png";
import stillWater from "@/assets/images/still water.png";

export const glyphMarketingMetadata: Metadata = {
  title: "Glyph — pojulife",
  description:
    "Where AI meets a thousand years of wisdom. A pocket-sized mirror — hold a question, draw a pattern, read what comes back.",
};

function linesFromGlyphDescription(description: string): string[] {
  const parts = description
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [description];
}

const HOW_STEP_ACCENTS = ["fuchsia", "magenta", "violet"] as const;

function WindText({
  name,
  lines,
  align = "left",
}: {
  name: string;
  lines: string[];
  align?: "left" | "right";
}) {
  return (
    <div className={cn("min-w-0 text-center", align === "right" ? "lg:text-right" : "lg:text-left")}>
      <p className="whitespace-nowrap text-[20px] font-semibold leading-tight tracking-[0.01em] text-white sm:text-[22px] md:text-[23px]">
        {name}
      </p>
      <div className="mt-1.5 space-y-1 text-[14px] leading-6 text-white/90 sm:text-[15px] sm:leading-7 md:text-[16px] md:leading-7">
        {lines.map((line) => (
          <p key={line} className="whitespace-normal break-words sm:whitespace-nowrap">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

export async function GlyphMarketingPage() {
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
    <MarketingPageLayout theme="glyph">
      <MarketingPageHero>
        <OracleProductHero
          copy={heroCopy}
          cta={
            <NotPWA>
              <GlyphPrepareCta />
            </NotPWA>
          }
        />
      </MarketingPageHero>

      <NotPWA>
      <MarketingPageSections>
        <MarketingSection
          id="five-winds"
          className="scroll-mt-28"
          title={t("five_winds.heading")}
          subtitle={t("five_winds.description")}
          padding="lg"
          allowOverflow
        >
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
                  <WindText name={divine.name} lines={divine.lines} />
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
                  <WindText name={still.name} lines={still.lines} />
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
                  <WindText name={eye.name} lines={eye.lines} />
                </div>
              </div>

              <div className="flex justify-center lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center lg:justify-start lg:pl-1">
                <div className="grid w-full max-w-xl grid-cols-[minmax(0,1fr)_128px] items-center gap-4">
                  <WindText name={fair.name} lines={fair.lines} align="right" />
                  <div className="w-full max-w-[128px] justify-self-end">
                    <WindCardWithParticles src={fair.image} alt={fair.imageAlt} particleKey={fair.particleKey} sizes="128px" />
                  </div>
                </div>
              </div>

              <div className="flex justify-center lg:col-start-2 lg:row-start-2 lg:row-span-2 lg:self-center lg:justify-start lg:pl-1">
                <div className="grid w-full max-w-xl grid-cols-[minmax(0,1fr)_128px] items-center gap-4">
                  <WindText name={cross.name} lines={cross.lines} align="right" />
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
          <div className="mx-auto mt-12 max-w-xl space-y-4 text-center">
            <p className="font-semibold uppercase tracking-[0.08em] text-white">{t("on_the_cards.heading")}</p>
            {onTheCardsParagraphs.map((para) => (
              <p key={para} className="marketing-section-intro">
                {para}
              </p>
            ))}
          </div>
        </MarketingSection>

        <MarketingSection id="glyph-how-it-works" title={t("how_it_works.heading")} padding="lg">
          <div className="marketing-accent-grid marketing-accent-grid--3 mx-auto max-w-4xl">
            {(["step_1", "step_2", "step_3"] as const).map((stepKey, idx) => {
              const accent = HOW_STEP_ACCENTS[idx] ?? "fuchsia";
              return (
                <article
                  key={stepKey}
                  className={`content-card content-card--solid content-card--${accent} text-center`}
                >
                  <p className="text-4xl font-semibold leading-none">{idx + 1}</p>
                  <p className="content-card__title mt-4">{t(`how_it_works.${stepKey}.title`)}</p>
                  <p className="mt-2">{t(`how_it_works.${stepKey}.description`)}</p>
                </article>
              );
            })}
          </div>
          <ul className="content-card content-card--solid content-card--magenta mx-auto mt-10 max-w-2xl space-y-3 text-left">
            {glyphUsageRules.map((rule) => (
              <li key={rule}>
                <span className="mr-2">◉</span>
                {rule}
              </li>
            ))}
          </ul>
          <p className="marketing-section-subheading mt-8 !mb-0">{t("how_it_works.session_reminder")}</p>
        </MarketingSection>

        <MarketingSection id="glyph-pricing" title={t("pricing.heading")} padding="lg">
          <p className="marketing-section-subheading mx-auto max-w-2xl">{t("pricing.body")}</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <GlyphPrepareCta />
            <p className="marketing-section-intro max-w-md text-sm opacity-90">{t("pricing.footnote")}</p>
          </div>
        </MarketingSection>

        <MarketingSection id="glyph-final-cta" className="scroll-mt-24" padding="lg">
          <div className="flex flex-col items-center text-center">
            <h2 className="marketing-section-heading">{t("final_cta.heading")}</h2>
            <p className="marketing-section-subheading">{t("final_cta.subtitle")}</p>
            <GlyphPrepareCta variant="final" />
            <p className="marketing-section-intro mt-2 max-w-md">{t("final_cta.cta_subline")}</p>
            <p className="marketing-section-intro mt-6 max-w-2xl text-sm opacity-90">{tCommon("read_with_wink")}</p>
          </div>
        </MarketingSection>
      </MarketingPageSections>
      </NotPWA>

      <PWAProductBeginCTA productId="glyph" price="$1.99" />
    </MarketingPageLayout>
  );
}
