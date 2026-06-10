"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { PWAProductBeginCTA } from "@/components/pwa/PWAProductBeginCTA";
import {
  MarketingPageLayout,
  MarketingPageSections,
} from "@/components/marketing/marketing-page-layout";
import {
  ProductHeroAccent,
  ProductHeroActions,
  ProductHeroContent,
  ProductHeroDescription,
  ProductHeroTitle,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { ProductWhatIsSection } from "@/components/marketing/product-what-is-section";
import { MatchSplineScene } from "@/components/match/MatchSplineScene";
import { PojuToolHandoffBanner } from "@/components/poju/PojuToolHandoffBanner";
import { useRouter } from "@/i18n/navigation";
import { usePojuToolHandoff } from "@/lib/poju/use-poju-tool-handoff";
import { cn } from "@/lib/utils/classnames";
import { isFirstTimeFree } from "@/lib/syncro/device-usage";
import "@/styles/poju-tool-handoff.css";

import "@/styles/match.css";

type Accent = "fuchsia" | "magenta" | "violet";

const FEATURES: { titleKey: string; descKey: string; accent: Accent; mediaLabel: string }[] = [
  {
    titleKey: "feature_two_charts_title",
    descKey: "feature_two_charts_desc",
    accent: "fuchsia",
    mediaLabel: "Two charts",
  },
  {
    titleKey: "feature_any_relationship_title",
    descKey: "feature_any_relationship_desc",
    accent: "magenta",
    mediaLabel: "Any relationship",
  },
  {
    titleKey: "feature_5_sections_title",
    descKey: "feature_5_sections_desc",
    accent: "violet",
    mediaLabel: "Full report",
  },
];

const HOW_STEP_ACCENTS: Accent[] = ["fuchsia", "magenta", "violet", "fuchsia"];

const USE_CASES: { titleKey: string; descKey: string; accent: Accent }[] = [
  { titleKey: "use_case_marriage_title", descKey: "use_case_marriage_desc", accent: "fuchsia" },
  { titleKey: "use_case_partnership_title", descKey: "use_case_partnership_desc", accent: "magenta" },
  { titleKey: "use_case_family_title", descKey: "use_case_family_desc", accent: "violet" },
  { titleKey: "use_case_hiring_title", descKey: "use_case_hiring_desc", accent: "fuchsia" },
  { titleKey: "use_case_relationship_title", descKey: "use_case_relationship_desc", accent: "magenta" },
  { titleKey: "use_case_friendship_title", descKey: "use_case_friendship_desc", accent: "violet" },
];

const REPORT_PREVIEW: {
  badge: string;
  badgeClass: "a" | "b" | "x" | "c" | "r";
  titleKey: string;
  descKey: string;
  accent: Accent;
}[] = [
  { badge: "A", badgeClass: "a", titleKey: "preview_a_title", descKey: "preview_a_desc", accent: "fuchsia" },
  { badge: "B", badgeClass: "b", titleKey: "preview_b_title", descKey: "preview_b_desc", accent: "magenta" },
  { badge: "×", badgeClass: "x", titleKey: "preview_combined_title", descKey: "preview_combined_desc", accent: "violet" },
  { badge: "◎", badgeClass: "c", titleKey: "preview_conclusion_title", descKey: "preview_conclusion_desc", accent: "fuchsia" },
  { badge: "→", badgeClass: "r", titleKey: "preview_actions_title", descKey: "preview_actions_desc", accent: "magenta" },
];

const PRICE_INCLUDES = ["include_1", "include_2", "include_3", "include_4", "include_5"] as const;

const FAQ_ITEMS = [
  { q: "faq_q1", a: "faq_a1" },
  { q: "faq_q2", a: "faq_a2" },
  { q: "faq_q3", a: "faq_a3" },
  { q: "faq_q4", a: "faq_a4" },
] as const;

const HOW_STEPS = ["how_step_1", "how_step_2", "how_step_3", "how_step_4"] as const;

const MATCH_CTA_CLASS =
  "marketing-pill-outline-cta marketing-pill-outline-cta--rose inline-flex min-w-[220px] justify-center px-8 py-3.5 text-[15px] font-semibold hover:-translate-y-0.5 hover:scale-[1.02] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] md:px-10 md:py-4 md:text-base";

function MatchMediaPlaceholder({ label, report }: { label: string; report?: boolean }) {
  return (
    <div className={cn("match-marketing-media", report && "match-marketing-media--report")} aria-hidden>
      <div className="match-marketing-media__rings" />
      <span className="match-marketing-media__label">{label}</span>
    </div>
  );
}

export function MatchHomePage() {
  const router = useRouter();
  const t = useTranslations("match.home");
  const tLoading = useTranslations("match");

  const pojuHandoff = usePojuToolHandoff("match");
  const [canFree, setCanFree] = useState<boolean | null>(null);

  useEffect(() => {
    void isFirstTimeFree("match").then(setCanFree);
  }, []);

  function handleStart() {
    if (canFree === null && !pojuHandoff?.quota_free) return;
    const useFree = pojuHandoff?.quota_free || canFree === true;
    sessionStorage.setItem("match_session_type", useFree ? "free" : "paid");
    if (pojuHandoff?.prefill.partner_relationship) {
      sessionStorage.setItem("match_relationship_prefill", pojuHandoff.prefill.partner_relationship);
    }
    router.push(useFree ? "/match/select-a" : "/match/payment");
  }

  const effectiveFree = pojuHandoff?.quota_free || canFree === true;

  if (canFree === null && !pojuHandoff) {
    return (
      <main className="match-home match-home--loading">
        <p>{tLoading("loading")}</p>
      </main>
    );
  }

  const ctaLabel = effectiveFree ? t("cta_free") : t("cta_paid");
  const heroNote = effectiveFree ? t("free_note") : t("paid_note");

  return (
    <MarketingPageLayout theme="match" className="match-home">
      <div className="w-full px-3 sm:px-4 md:px-6">
        <ArchiveReturnBanner />
        {pojuHandoff ? <PojuToolHandoffBanner handoff={pojuHandoff} className="mt-4" /> : null}
      </div>

      <ProductMarketingHero
        theme="match"
        backgroundClassName="product-hero__bg--match"
        background={<MatchSplineScene variant="hero" className="match-hero-spline" pointerFollow={false} />}
      >
        <ProductHeroContent>
          <ProductHeroTitle gradient>MATCH</ProductHeroTitle>
          <ProductHeroAccent>{t("tagline")}</ProductHeroAccent>
          <ProductHeroDescription>{t("description")}</ProductHeroDescription>
          <ProductHeroActions>
            <NotPWA>
              <button type="button" onClick={handleStart} className={MATCH_CTA_CLASS}>
                {ctaLabel}
              </button>
              <p className="product-hero__actions-note">{heroNote}</p>
            </NotPWA>
          </ProductHeroActions>
        </ProductHeroContent>
      </ProductMarketingHero>

      <ProductWhatIsSection product="match" />

      <PWAProductBeginCTA productId="match" price="$4.99" />

      <NotPWA>
        <MarketingPageSections>
          <MarketingSection padding="lg">
            <div className="marketing-accent-grid marketing-accent-grid--3 mx-auto max-w-6xl">
              {FEATURES.map((feature) => (
                <article key={feature.titleKey} className={`content-card content-card--${feature.accent}`}>
                  <MatchMediaPlaceholder label={feature.mediaLabel} />
                  <div className="content-card__body">
                    <p className="content-card__title">{t(feature.titleKey)}</p>
                    <p className="mt-2">{t(feature.descKey)}</p>
                  </div>
                </article>
              ))}
            </div>
          </MarketingSection>

          <MarketingSection id="match-how-it-works" title={t("how_title")} subtitle={t("how_label")} padding="lg">
            <div className="marketing-accent-grid marketing-accent-grid--4 mx-auto max-w-5xl">
              {HOW_STEPS.map((step, idx) => {
                const accent = HOW_STEP_ACCENTS[idx] ?? "fuchsia";
                return (
                  <article
                    key={step}
                    className={`content-card content-card--solid content-card--${accent} text-center`}
                  >
                    <p className="text-3xl font-semibold leading-none">{idx + 1}</p>
                    <p className="content-card__title mt-4">{t(`${step}_title`)}</p>
                    <p className="mt-2">{t(`${step}_desc`)}</p>
                  </article>
                );
              })}
            </div>
          </MarketingSection>

          <MarketingSection id="match-use-cases" title={t("use_cases_title")} padding="lg">
            <div className="marketing-accent-grid md:grid-cols-2 lg:grid-cols-3">
              {USE_CASES.map((item) => (
                <article key={item.titleKey} className={`content-card content-card--solid content-card--${item.accent}`}>
                  <p className="content-card__title">{t(item.titleKey)}</p>
                  <p className="mt-2">{t(item.descKey)}</p>
                </article>
              ))}
            </div>
          </MarketingSection>

          <MarketingSection id="match-report-preview" title={t("whatyouget_title")} padding="lg">
            <div className="match-report-preview-grid mx-auto max-w-5xl">
              <div className="mx-auto w-full max-w-sm lg:max-w-none">
                <MatchMediaPlaceholder label="Report preview" report />
              </div>
              <div className="match-report-sections">
                {REPORT_PREVIEW.map((item) => (
                  <article
                    key={item.titleKey}
                    className={`content-card content-card--solid content-card--${item.accent} match-report-section-card`}
                  >
                    <span className={`match-report-badge match-report-badge--${item.badgeClass}`}>{item.badge}</span>
                    <div className="min-w-0">
                      <p className="content-card__title">{t(item.titleKey)}</p>
                      <p className="mt-2">{t(item.descKey)}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </MarketingSection>

          <MarketingSection id="match-pricing" padding="lg">
            <div className="flex flex-col items-center text-center">
              <h2 className="marketing-section-heading">$4.99</h2>
              <p className="marketing-section-subheading">
                {t("per_reading")} · {heroNote}
              </p>
              <article className="content-card content-card--solid content-card--fuchsia match-pricing-card mt-10">
                <ul className="match-pricing-includes">
                  {PRICE_INCLUDES.map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ul>
                <button type="button" onClick={handleStart} className={cn(MATCH_CTA_CLASS, "mt-8 w-full")}>
                  {ctaLabel}
                </button>
                {effectiveFree ? (
                  <p className="marketing-section-intro mt-4 text-sm opacity-90">{t("first_free_emphasized")}</p>
                ) : null}
              </article>
            </div>
          </MarketingSection>

          <MarketingSection title={t("not_title")} padding="lg">
            <div className="marketing-accent-grid marketing-accent-grid--2 mx-auto max-w-4xl">
              <article className="content-card content-card--solid content-card--magenta">
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">{t("not_title")}</p>
                <ul className="mt-5 space-y-3">
                  {(t.raw("not_items") as string[]).map((item) => (
                    <li key={item}>
                      <span className="mr-1">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="content-card content-card--solid content-card--fuchsia">
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">{t("whatyouget_title")}</p>
                <ul className="mt-5 space-y-3">
                  {PRICE_INCLUDES.slice(0, 4).map((key) => (
                    <li key={key}>
                      <span className="mr-1">✦</span>
                      {t(key)}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm leading-relaxed opacity-95">{t("not_footer")}</p>
              </article>
            </div>
          </MarketingSection>

          <MarketingSection id="match-faq" title={t("faq_title")} padding="lg">
            <div className="match-faq-wrap">
              <div className="match-faq-list">
                {FAQ_ITEMS.map((item, idx) => (
                  <details
                    key={item.q}
                    className={`match-faq-item content-card content-card--solid content-card--${idx % 2 === 0 ? "violet" : "magenta"}`}
                  >
                    <summary>{t(item.q)}</summary>
                    <p>{t(item.a)}</p>
                  </details>
                ))}
              </div>
            </div>
          </MarketingSection>
        </MarketingPageSections>
      </NotPWA>
    </MarketingPageLayout>
  );
}
