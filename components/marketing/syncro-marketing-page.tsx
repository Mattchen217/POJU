import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DsSyncroFitCard } from "@/components/ds/marketing/DsProductFlows";
import { DsGlassCard, DsMutedCard } from "@/components/ds/primitives";
import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { AppModeDesktopHint } from "@/components/pwa/AppModeDesktopHint";
import { AppModeProductTopBar } from "@/components/pwa/AppModeProductTopBar";
import { SyncroDesktopQrSection } from "@/components/marketing/syncro-desktop-qr-section";
import { ProductPricingSection } from "@/components/marketing/product-pricing-section";
import { SyncroHowItWorksSection } from "@/components/marketing/syncro-how-it-works-section";
import { SyncroMarketingPhonePreview } from "@/components/marketing/syncro-marketing-phone-preview";
import { SyncroPwaInstallProvider } from "@/components/syncro/SyncroPwaInstallGuide";
import {
  MarketingPageHero,
  MarketingPageLayout,
  MarketingPageSections,
} from "@/components/marketing/marketing-page-layout";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { ProductWhatIsSection } from "@/components/marketing/product-what-is-section";
import { SyncroProductHero } from "@/components/marketing/syncro-product-hero";

export const syncroMarketingMetadata: Metadata = {
  title: "Syncro — pojulife",
  description:
    "See your natural rhythms. First Syncro free, then $4.99 per 24-hour window — mobile only.",
};

const USE_CASE_KEYS = ["before_matters", "pace_off", "daily_rhythm", "traveling", "poju_companion"] as const;

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
    cta: t("hero.cta"),
  };

  const syncroSteps = [
    { title: t("how_it_works.step_1_title"), desc: t("how_it_works.step_1_desc") },
    { title: t("how_it_works.step_2_title"), desc: t("how_it_works.step_2_desc") },
    { title: t("how_it_works.step_3_title"), desc: t("how_it_works.step_3_desc") },
    { title: t("how_it_works.step_4_title"), desc: t("how_it_works.step_4_desc") },
  ];

  return (
    <SyncroPwaInstallProvider>
      <MarketingPageLayout theme="syncro" component="div">
        <AppModeProductTopBar />
        <MarketingPageHero>
          <NotPWA>
          <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
            <ArchiveReturnBanner />
          </div>
          </NotPWA>
          <SyncroProductHero copy={heroCopy} />
        </MarketingPageHero>
        <AppModeDesktopHint />

        <MarketingPageSections>
          <ProductWhatIsSection product="syncro" />

          <NotPWA>
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
          </NotPWA>

          <NotPWA>
          <SyncroHowItWorksSection
            heading={t("how_it_works.heading")}
            intro={t("how_it_works.intro")}
            steps={syncroSteps}
          />
          </NotPWA>

          <NotPWA>
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
              <p className="marketing-section-subheading mx-auto max-w-2xl text-center">{t("why_mobile.body")}</p>
              <SyncroDesktopQrSection qrLabel={t("hero.qr_label")} qrAlt={t("hero.qr_label")} />
            </MarketingSection>

            <MarketingSection title={t("what_it_is.heading")} padding="lg">
              <div className="marketing-accent-grid marketing-accent-grid--2 mx-auto max-w-4xl">
                <DsMutedCard accent="blue">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em]">{t("what_it_is.shows.title")}</p>
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
                  <p className="text-xs font-semibold uppercase tracking-[0.14em]">{t("what_it_is.isnt.title")}</p>
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
          </NotPWA>
        </MarketingPageSections>
      </MarketingPageLayout>
    </SyncroPwaInstallProvider>
  );
}
