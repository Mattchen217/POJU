import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DsSyncroFitCard, DsSyncroFlow } from "@/components/ds/marketing/DsProductFlows";
import { DsGlassCard, DsMutedCard } from "@/components/ds/primitives";
import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { SyncroDesktopQrSection } from "@/components/marketing/syncro-desktop-qr-section";
import { SyncroMarketingPhonePreview } from "@/components/marketing/syncro-marketing-phone-preview";
import { SyncroPricingCta } from "@/components/marketing/syncro-pricing-cta";
import { SyncroPwaInstallProvider } from "@/components/syncro/SyncroPwaInstallGuide";
import { SyncroPwaHomeFooter } from "@/components/syncro/SyncroPwaHomeFooter";
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
        <MarketingPageHero>
          <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
            <ArchiveReturnBanner />
          </div>
          <SyncroProductHero copy={heroCopy} />
        </MarketingPageHero>

        <MarketingPageSections>
          <ProductWhatIsSection product="syncro" />

          <NotPWA>
            <MarketingSection id="syncro-how-it-works" title={t("how_it_works.heading")} padding="lg">
              <p className="marketing-section-intro mx-auto max-w-2xl text-center">{t("how_it_works.intro")}</p>
              <div className="mt-9">
                <DsSyncroFlow steps={syncroSteps} />
              </div>
            </MarketingSection>

            <MarketingSection id="syncro-five-currents" title={t("five_currents.heading")} padding="lg">
              <p className="marketing-section-intro mx-auto max-w-2xl text-center">{t("five_currents.intro")}</p>
              <ul className="mx-auto mt-8 max-w-2xl space-y-3">
                {(t.raw("five_currents.items") as { name: string; desc: string }[]).map((item, idx) => {
                  const colors = ["var(--pj-open)", "var(--pj-following)", "var(--pj-still)", "var(--pj-cross)", "var(--pj-under)"];
                  const dotColor = colors[idx] ?? "var(--pj-teal)";
                  return (
                    <li key={item.name} className="ds-current-row">
                      <span
                        className="ds-current-row__dot"
                        style={{ background: dotColor, boxShadow: `0 0 12px ${dotColor}` }}
                        aria-hidden
                      />
                      <span className="ds-current-row__name">{item.name}</span>
                      <span className="ds-current-row__desc">{item.desc}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="marketing-section-intro mx-auto mt-8 max-w-2xl text-center">{t("five_currents.footer")}</p>
            </MarketingSection>

            <MarketingSection id="syncro-why-mobile" title={t("why_mobile.heading")} padding="lg">
              <p className="marketing-section-subheading mx-auto max-w-2xl text-center">{t("why_mobile.body")}</p>
              <SyncroDesktopQrSection qrLabel={t("hero.qr_label")} qrAlt={t("hero.qr_label")} />
            </MarketingSection>

            <MarketingSection title={t("what_shows.heading")} padding="lg">
              <div className="mx-auto flex max-w-lg flex-col items-center">
                <SyncroMarketingPhonePreview />
              </div>
              <div className="mx-auto mt-10 max-w-2xl space-y-4 text-center">
                <p className="marketing-section-intro">{t("what_shows.intro")}</p>
                <DsGlassCard className="mx-auto max-w-xl text-left">
                  <p className="text-[var(--pj-text-secondary)]">{t("what_shows.items_intro")}</p>
                  <ul className="mt-4 space-y-2 text-[var(--pj-text-secondary)]">
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
            </MarketingSection>

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

            <MarketingSection padding="lg">
              <div className="flex flex-col items-center text-center">
                <h2 className="marketing-section-heading">{t("pricing.heading")}</h2>
                <p className="marketing-section-subheading">{t("pricing.description")}</p>
                <SyncroPricingCta label={t("pricing.cta")} />
              </div>
            </MarketingSection>
          </NotPWA>
        </MarketingPageSections>

        <SyncroPwaHomeFooter />
      </MarketingPageLayout>
    </SyncroPwaInstallProvider>
  );
}
