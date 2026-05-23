import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";
import {
  MarketingPageHero,
  MarketingPageLayout,
  MarketingPageSections,
} from "@/components/marketing/marketing-page-layout";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { SyncroProductHero } from "@/components/marketing/syncro-product-hero";
import { Link } from "@/i18n/navigation";

export const syncroMarketingMetadata: Metadata = {
  title: "Syncro — pojulife",
  description:
    "Where AI meets a thousand years of wisdom. A light rhythm map you can open through your day — free on mobile.",
};

const USE_CASE_KEYS = ["before_matters", "pace_off", "daily_rhythm", "traveling", "poju_companion"] as const;
const USE_CASE_ACCENTS = ["blue", "violet", "magenta", "fuchsia", "blue"] as const;

export async function SyncroMarketingPage() {
  const t = await getTranslations("marketingSite.syncro");
  const whatShowsItems = t.raw("what_shows.items") as string[];
  const showsItems = t.raw("what_it_is.shows.items") as string[];
  const isntItems = t.raw("what_it_is.isnt.items") as string[];

  const heroCopy = {
    heading: t("hero.heading"),
    subtitle: t("hero.subtitle"),
    description: t("hero.description"),
    tagline: t("hero.tagline"),
    footnote: t("hero.footnote"),
    qrLabel: t("hero.qr_label"),
    qrAlt: t("hero.qr_label"),
    smsForm: {
      hint: t("hero.sms_label"),
      placeholder: t("hero.phone_placeholder"),
      phoneAriaLabel: t("hero.phone_placeholder"),
      buttonLabel: t("hero.sms_button"),
      smsBodyTemplate: t("hero.sms_body"),
    },
  };

  return (
    <MarketingPageLayout theme="syncro" component="div">
      <MarketingPageHero>
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
          <ArchiveReturnBanner />
        </div>
        <SyncroProductHero copy={heroCopy} />
      </MarketingPageHero>

      <MarketingPageSections>
        <MarketingSection title={t("what_shows.heading")} padding="lg">
          <div className="mx-auto flex max-w-lg flex-col items-center">
            <div className="aspect-[9/19] w-full max-w-[280px] rounded-[2rem] border border-white/20 bg-gradient-to-b from-white/15 to-black/30 shadow-[0_14px_36px_rgba(0,0,0,0.32)]">
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-white/70">{t("what_shows.preview_label")}</p>
                <p className="marketing-section-intro mt-3">{t("what_shows.preview_placeholder")}</p>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-10 max-w-2xl space-y-4 text-center">
            <p className="marketing-section-intro">{t("what_shows.intro")}</p>
            <article className="content-card content-card--solid content-card--blue mx-auto max-w-xl text-left">
              <p className="marketing-section-intro !text-left">{t("what_shows.items_intro")}</p>
              <ul className="mt-4 space-y-2">
                {whatShowsItems.map((item) => (
                  <li key={item}>
                    <span className="mr-1">✦</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
            <p className="marketing-section-intro">{t("what_shows.footnote")}</p>
          </div>
        </MarketingSection>

        <MarketingSection id="syncro-use-cases" title={t("use_cases.heading")} padding="lg">
          <div className="marketing-accent-grid marketing-accent-grid--5">
            {USE_CASE_KEYS.map((key, idx) => {
              const accent = USE_CASE_ACCENTS[idx] ?? "blue";
              return (
                <article key={key} className={`content-card content-card--solid content-card--${accent}`}>
                  <p className="content-card__title">{t(`use_cases.${key}.title`)}</p>
                  <p className="mt-2 whitespace-pre-line">{t(`use_cases.${key}.description`)}</p>
                </article>
              );
            })}
          </div>
        </MarketingSection>

        <MarketingSection title={t("what_it_is.heading")} padding="lg">
          <div className="marketing-accent-grid marketing-accent-grid--2 mx-auto max-w-4xl">
            <article className="content-card content-card--solid content-card--blue">
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">{t("what_it_is.shows.title")}</p>
              <ul className="mt-5 space-y-3">
                {showsItems.map((item) => (
                  <li key={item}>
                    <span className="mr-1">✦</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="content-card content-card--solid content-card--magenta">
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">{t("what_it_is.isnt.title")}</p>
              <ul className="mt-5 space-y-3">
                {isntItems.map((item) => (
                  <li key={item}>
                    <span className="mr-1">✗</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </MarketingSection>

        <MarketingSection padding="lg">
          <div className="flex flex-col items-center text-center">
            <h2 className="marketing-section-heading">{t("always_free.heading")}</h2>
            <p className="marketing-section-subheading">{t("always_free.description")}</p>
            <Link href="#syncro-start" className="glass-btn glass-btn-primary glass-btn-large mt-8">
              {t("always_free.cta")}
            </Link>
          </div>
        </MarketingSection>
      </MarketingPageSections>
    </MarketingPageLayout>
  );
}
