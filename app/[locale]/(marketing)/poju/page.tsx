import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Compass, GitBranch, RefreshCcw, Search, UserRoundSearch } from "lucide-react";

import { PojuHowWorksRing } from "@/components/marketing/poju-how-works-ring";
import {
  MarketingPageHero,
  MarketingPageLayout,
  MarketingPageSections,
} from "@/components/marketing/marketing-page-layout";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { PojuSessionStarter } from "@/components/poju/poju-session-starter";
import { PojuProductHero } from "@/components/marketing/poju-product-hero";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { PWAProductBeginCTA } from "@/components/pwa/PWAProductBeginCTA";
import { PojuStep2Entry } from "@/components/poju/poju-step2-entry";

export const metadata: Metadata = {
  title: "pojulife — Break your deadlock",
  description:
    "Where AI meets a thousand years of wisdom. Decision support for the questions that won't let you go.",
};
export const dynamic = "force-dynamic";

const WHEN_KEYS = ["stuck", "confused", "repeating", "depth", "direction"] as const;
const STEP_NUMS = ["1", "2", "3", "4", "5", "6"] as const;
const WHEN_CARD_META: Record<
  (typeof WHEN_KEYS)[number],
  {
    trigger: string;
    icon: typeof GitBranch;
  }
> = {
  stuck: { trigger: "BINARY DEADLOCK", icon: GitBranch },
  confused: { trigger: "INFO OVERLOAD", icon: Search },
  repeating: { trigger: "CYCLIC BEHAVIOR", icon: RefreshCcw },
  depth: { trigger: "SHALLOW FEEDBACK", icon: UserRoundSearch },
  direction: { trigger: "GUIDANCE REQ", icon: Compass },
};

const WHEN_ACCENTS = ["violet", "magenta", "blue", "fuchsia", "violet"] as const;

export default async function PojuProductPage() {
  const t = await getTranslations("marketingSite.poju");
  const howSteps = STEP_NUMS.map((k) => t(`how_it_works.steps.${k}`));
  const includedItems = t.raw("two_columns.included.items") as string[];
  const notIncludedItems = t.raw("two_columns.not_included.items") as string[];

  const heroCopy = {
    heading: t("hero.heading"),
    description: t("hero.description"),
    tagline: t("hero.tagline"),
    ctaPrimary: t("hero.cta_primary"),
  };

  return (
    <MarketingPageLayout theme="poju">
      <MarketingPageHero>
        <PojuProductHero copy={heroCopy} />
      </MarketingPageHero>

      <NotPWA>
      <MarketingPageSections>
        <MarketingSection id="when-to-poju" title={t("when_to_come.heading")} padding="lg">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {WHEN_KEYS.map((key, idx) => {
              const Icon = WHEN_CARD_META[key].icon;
              const accent = WHEN_ACCENTS[idx] ?? "violet";
              return (
                <article
                  key={key}
                  className={`content-card content-card--solid content-card--${accent} min-h-[172px] sm:min-h-[188px] ${
                    idx === WHEN_KEYS.length - 1 ? "lg:col-span-1 md:col-span-2" : ""
                  }`}
                >
                  <Icon className="h-4 w-4 text-white" strokeWidth={2.2} aria-hidden />
                  <p className="content-card__title mt-5 max-w-[24ch] text-[21px] leading-[1.15] sm:text-[22px]">
                    {t(`when_to_come.${key}.title`)}
                  </p>
                  <p className="mt-2 max-w-[32ch] text-[17px] leading-[1.4] sm:text-[18px]">
                    {t(`when_to_come.${key}.description`)}
                  </p>
                  <p className="mt-4 font-mono text-[13px] uppercase tracking-[0.08em] text-white/80">
                    TRIGGER: {WHEN_CARD_META[key].trigger}
                  </p>
                </article>
              );
            })}
          </div>
        </MarketingSection>

        <MarketingSection
          id="how-poju-works"
          title={t("how_it_works.heading")}
          subtitle={t("how_it_works.subtitle")}
          padding="lg"
        >
          <PojuHowWorksRing steps={howSteps} />
          <ol className="sr-only">
            {howSteps.map((label, idx) => (
              <li key={label}>{`${idx + 1}. ${label}`}</li>
            ))}
          </ol>
          <p className="marketing-section-subheading mt-8 !mb-0">{t("how_it_works.footer")}</p>
        </MarketingSection>

        <MarketingSection id="poju-cta" title={t("two_columns.heading")} padding="lg">
          <div className="marketing-accent-grid marketing-accent-grid--2 mx-auto max-w-4xl">
            <article className="content-card content-card--solid content-card--violet">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
                {t("two_columns.included.title")}
              </p>
              <ul className="mt-5 space-y-3">
                {includedItems.map((item) => (
                  <li key={item}>
                    <span className="mr-1">✦</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="content-card content-card--solid content-card--magenta">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
                {t("two_columns.not_included.title")}
              </p>
              <ul className="mt-5 space-y-3">
                {notIncludedItems.map((item) => (
                  <li key={item}>
                    <span className="mr-1">✗</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
          <p className="marketing-section-subheading mt-8">{t("two_columns.tagline")}</p>
          <div className="mt-10 flex flex-col items-center text-center">
            <PojuSessionStarter className="glass-btn glass-btn-primary glass-btn-large">
              {t("two_columns.cta")}
            </PojuSessionStarter>
            <p className="marketing-section-subheading mt-6 !max-w-2xl">{t("two_columns.footnote")}</p>
          </div>
          <PojuStep2Entry />
        </MarketingSection>
      </MarketingPageSections>
      </NotPWA>

      <PWAProductBeginCTA productId="poju" price="$9.99" />
    </MarketingPageLayout>
  );
}
