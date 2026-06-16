import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DsWhenPojuCard, type PojuWhenIconKey } from "@/components/ds/marketing/DsWhenPojuCard";
import { PojuHowWorksRing } from "@/components/marketing/poju-how-works-ring";
import {
  MarketingPageHero,
  MarketingPageLayout,
  MarketingPageSections,
} from "@/components/marketing/marketing-page-layout";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { ProductPricingSection } from "@/components/marketing/product-pricing-section";
import { ProductWhatIsSection } from "@/components/marketing/product-what-is-section";
import { PojuProductHero } from "@/components/marketing/poju-product-hero";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { AppModeDesktopHint } from "@/components/pwa/AppModeDesktopHint";
import { AppModeProductTopBar } from "@/components/pwa/AppModeProductTopBar";

export const metadata: Metadata = {
  title: "pojulife — Break your deadlock",
  description:
    "Where AI meets a thousand years of wisdom. Decision support for the questions that won't let you go.",
};
export const dynamic = "force-dynamic";

const WHEN_KEYS = ["stuck", "confused", "repeating", "depth", "direction"] as const satisfies readonly PojuWhenIconKey[];
const STEP_NUMS = ["1", "2", "3", "4", "5", "6"] as const;

export default async function PojuProductPage() {
  const t = await getTranslations("marketingSite.poju");
  const howSteps = STEP_NUMS.map((k) => ({
    title: t(`how_it_works.steps.${k}.title`),
    description: t(`how_it_works.steps.${k}.description`),
  }));
  const includedItems = t.raw("two_columns.included.items") as string[];
  const notIncludedItems = t.raw("two_columns.not_included.items") as string[];

  const heroCopy = {
    brandTag: t("hero.brand_tag"),
    heading: t("hero.heading"),
    description: t("hero.description"),
    tagline: t("hero.tagline"),
    ctaPrimary: t("hero.cta_primary"),
    billingNotice: t("hero.billing_notice"),
  };

  return (
    <MarketingPageLayout theme="poju">
      <AppModeProductTopBar />
      <MarketingPageHero>
        <PojuProductHero copy={heroCopy} />
      </MarketingPageHero>
      <AppModeDesktopHint />

      <MarketingPageSections>
        <ProductWhatIsSection product="poju" />

        <NotPWA>
          <MarketingSection id="when-to-poju" title={t("when_to_come.heading")} padding="lg">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {WHEN_KEYS.map((key, idx) => (
                  <DsWhenPojuCard
                    key={key}
                    index={idx + 1}
                    iconKey={key}
                    title={t(`when_to_come.${key}.title`)}
                    description={t(`when_to_come.${key}.description`)}
                  />
              ))}
            </div>
          </MarketingSection>

          <MarketingSection
            id="how-poju-works"
            title={t("how_it_works.heading")}
            subtitle={t("how_it_works.subtitle")}
            padding="default"
            className="[&_.marketing-section-subheading]:!mt-4 [&_.marketing-section-subheading]:!mb-0 [&>div:last-child]:!mt-16 sm:[&>div:last-child]:!mt-20"
          >
            <PojuHowWorksRing steps={howSteps} />
            <ol className="sr-only">
              {howSteps.map((step, idx) => (
                <li key={STEP_NUMS[idx]}>{`${idx + 1}. ${step.title}. ${step.description}`}</li>
              ))}
            </ol>
            <div className="mx-auto mt-20 max-w-2xl text-center sm:mt-24 md:mt-28">
              <p className="m-0 text-lg font-semibold text-[var(--pj-gold-soft)] sm:text-xl">
                {t("how_it_works.footer.title")}
              </p>
              <p className="marketing-section-subheading mt-4 !mb-0 !max-w-none text-[15px] leading-relaxed sm:text-base">
                {t("how_it_works.footer.description")}
              </p>
            </div>
          </MarketingSection>

          <MarketingSection id="poju-cta" title={t("two_columns.heading")} padding="lg">
            <div className="marketing-accent-grid marketing-accent-grid--2 mx-auto max-w-4xl">
              <article className="ds-glass-card ds-glass-card--included">
                <p className="text-lg font-semibold text-[var(--pj-gold-soft)]">{t("two_columns.included.title")}</p>
                <ul className="mt-4 space-y-3">
                  {includedItems.map((item) => (
                    <li key={item} className="flex gap-2 text-[15px] text-[var(--pj-text-secondary)]">
                      <span className="text-[var(--pj-gold)]">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="ds-glass-card">
                <p className="text-lg font-semibold text-[var(--pj-text-primary)]">
                  {t("two_columns.not_included.title")}
                </p>
                <ul className="mt-4 space-y-3">
                  {notIncludedItems.map((item) => (
                    <li key={item} className="flex gap-2 text-[15px] text-[var(--pj-text-secondary)]">
                      <span className="text-[var(--pj-text-muted)]">—</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
            <p className="marketing-section-subheading mt-8">{t("two_columns.tagline")}</p>
          </MarketingSection>

          <ProductPricingSection product="poju" />
        </NotPWA>
      </MarketingPageSections>
    </MarketingPageLayout>
  );
}
