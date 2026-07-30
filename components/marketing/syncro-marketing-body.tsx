"use client";

import { useTranslations } from "next-intl";

import { DsSyncroFitCard } from "@/components/ds/marketing/DsProductFlows";
import { DsGlassCard, DsMutedCard } from "@/components/ds/primitives";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { ProductPricingSection } from "@/components/marketing/product-pricing-section";
import { ProductWhatIsSection } from "@/components/marketing/product-what-is-section";
import { SyncroDesktopQrSection } from "@/components/marketing/syncro-desktop-qr-section";
import { SyncroHowItWorksSection } from "@/components/marketing/syncro-how-it-works-section";
import { SyncroMarketingPhonePreview } from "@/components/marketing/syncro-marketing-phone-preview";

import "@/styles/syncro-marketing-preview.css";

const USE_CASE_KEYS = ["before_matters", "pace_off", "daily_rhythm", "traveling", "poju_companion"] as const;

type Props = {
  /** Include What-is band (default true). Marketing PWA keeps What-is outside NotPWA. */
  includeWhatIs?: boolean;
};

/**
 * Syncro marketing body below hero — shared by /syncro and workspace Syncro tab.
 * Caller should wrap with SyncroPwaInstallProvider when QR / install CTAs need it.
 */
export function SyncroMarketingBody({ includeWhatIs = true }: Props) {
  const t = useTranslations("marketingSite.syncro");
  const whatShowsItems = t.raw("what_shows.items") as string[];
  const showsItems = t.raw("what_it_is.shows.items") as string[];
  const isntItems = t.raw("what_it_is.isnt.items") as string[];

  const syncroSteps = [
    { title: t("how_it_works.step_1_title"), desc: t("how_it_works.step_1_desc") },
    { title: t("how_it_works.step_2_title"), desc: t("how_it_works.step_2_desc") },
    { title: t("how_it_works.step_3_title"), desc: t("how_it_works.step_3_desc") },
    { title: t("how_it_works.step_4_title"), desc: t("how_it_works.step_4_desc") },
  ];

  return (
    <div className="syncro-marketing-body">
      {includeWhatIs ? <ProductWhatIsSection product="syncro" /> : null}

      <MarketingSection id="syncro-use-cases" title={t("use_cases.heading")} padding="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASE_KEYS.map((key, idx) => (
            <DsSyncroFitCard
              key={key}
              index={idx}
              title={t(`use_cases.${key}.title`)}
              description={t(`use_cases.${key}.description`)}
            />
          ))}
        </div>
      </MarketingSection>

      <SyncroHowItWorksSection
        heading={t("how_it_works.heading")}
        intro={t("how_it_works.intro")}
        steps={syncroSteps}
      />

      <MarketingSection title={t("what_shows.heading")} padding="lg">
        <div className="syncro-what-shows-layout">
          <div className="syncro-what-shows-layout__phone">
            <SyncroMarketingPhonePreview />
          </div>
          <div className="syncro-what-shows-layout__copy">
            <p className="marketing-section-intro">{t("what_shows.intro")}</p>
            <DsGlassCard className="text-left text-white">
              <p>{t("what_shows.items_intro")}</p>
              <ul className="mt-4 space-y-2">
                {whatShowsItems.map((item) => (
                  <li key={item}>
                    <span className="mr-1">✦</span>
                    {item}
                  </li>
                ))}
              </ul>
            </DsGlassCard>
            <p className="marketing-section-intro">{t("what_shows.footnote")}</p>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection id="syncro-why-mobile" title={t("why_mobile.heading")} padding="lg">
        <p className="marketing-section-subheading mx-auto max-w-2xl text-center">
          {t("why_mobile.body")}
        </p>
        <SyncroDesktopQrSection qrLabel={t("hero.qr_label")} qrAlt={t("hero.qr_label")} />
      </MarketingSection>

      <MarketingSection title={t("what_it_is.heading")} padding="lg">
        <div className="marketing-accent-grid marketing-accent-grid--2 mx-auto max-w-4xl">
          <DsMutedCard accent="blue">
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">
              {t("what_it_is.shows.title")}
            </p>
            <ul className="mt-5 space-y-3">
              {showsItems.map((item) => (
                <li key={item}>
                  <span className="mr-1">✦</span>
                  {item}
                </li>
              ))}
            </ul>
          </DsMutedCard>
          <DsMutedCard accent="magenta">
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">
              {t("what_it_is.isnt.title")}
            </p>
            <ul className="mt-5 space-y-3">
              {isntItems.map((item) => (
                <li key={item}>
                  <span className="mr-1">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </DsMutedCard>
        </div>
      </MarketingSection>

      <ProductPricingSection product="syncro" />
    </div>
  );
}
