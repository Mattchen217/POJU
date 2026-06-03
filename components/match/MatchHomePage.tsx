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
import { MatchSplineScene } from "@/components/match/MatchSplineScene";
import { GlassCard } from "@/components/ui/GlassCard";
import { PojuToolHandoffBanner } from "@/components/poju/PojuToolHandoffBanner";
import { useRouter } from "@/i18n/navigation";
import { usePojuToolHandoff } from "@/lib/poju/use-poju-tool-handoff";
import { isFirstTimeFree } from "@/lib/syncro/device-usage";
import "@/styles/poju-tool-handoff.css";

import "@/styles/match.css";

const FEATURES = [
  { icon: "👥", titleKey: "feature_two_charts_title", descKey: "feature_two_charts_desc" },
  { icon: "🔮", titleKey: "feature_any_relationship_title", descKey: "feature_any_relationship_desc" },
  { icon: "📋", titleKey: "feature_5_sections_title", descKey: "feature_5_sections_desc" },
] as const;

const USE_CASES = [
  { icon: "💍", titleKey: "use_case_marriage_title", descKey: "use_case_marriage_desc" },
  { icon: "🤝", titleKey: "use_case_partnership_title", descKey: "use_case_partnership_desc" },
  { icon: "👨‍👩‍👧", titleKey: "use_case_family_title", descKey: "use_case_family_desc" },
  { icon: "💼", titleKey: "use_case_hiring_title", descKey: "use_case_hiring_desc" },
  { icon: "💔", titleKey: "use_case_relationship_title", descKey: "use_case_relationship_desc" },
  { icon: "🌱", titleKey: "use_case_friendship_title", descKey: "use_case_friendship_desc" },
] as const;

const REPORT_PREVIEW = [
  { badge: "a", badgeClass: "a", titleKey: "preview_a_title", descKey: "preview_a_desc" },
  { badge: "b", badgeClass: "b", titleKey: "preview_b_title", descKey: "preview_b_desc" },
  { badge: "×", badgeClass: "x", titleKey: "preview_combined_title", descKey: "preview_combined_desc" },
  { badge: "🎯", badgeClass: "c", titleKey: "preview_conclusion_title", descKey: "preview_conclusion_desc" },
  { badge: "📋", badgeClass: "r", titleKey: "preview_actions_title", descKey: "preview_actions_desc" },
] as const;

const PRICE_INCLUDES = ["include_1", "include_2", "include_3", "include_4", "include_5"] as const;

const FAQ_ITEMS = [
  { q: "faq_q1", a: "faq_a1" },
  { q: "faq_q2", a: "faq_a2" },
  { q: "faq_q3", a: "faq_a3" },
  { q: "faq_q4", a: "faq_a4" },
] as const;

const HOW_STEPS = ["how_step_1", "how_step_2", "how_step_3", "how_step_4"] as const;

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
        background={<MatchSplineScene variant="hero" className="match-hero-spline" pointerFollow={false} />}
      >
        <ProductHeroContent>
          <ProductHeroTitle gradient>MATCH</ProductHeroTitle>
          <ProductHeroAccent>{t("tagline")}</ProductHeroAccent>
          <ProductHeroDescription>{t("description")}</ProductHeroDescription>
          <ProductHeroActions>
            <NotPWA>
              <button
                type="button"
                onClick={handleStart}
                className="glass-btn glass-btn-primary glass-btn-large match-primary-btn"
              >
                {ctaLabel}
              </button>
              <p className="product-hero__actions-note">{heroNote}</p>
            </NotPWA>
          </ProductHeroActions>
        </ProductHeroContent>
      </ProductMarketingHero>

      <PWAProductBeginCTA productId="match" price="$4.99" />

      <NotPWA>
      <MarketingPageSections>
        <MarketingSection padding="lg">
          <div className="features-section marketing-accent-grid marketing-accent-grid--3">
            {FEATURES.map((feature) => (
              <GlassCard key={feature.titleKey} padding="lg">
                <div className="match-feature-row">
                  <span className="match-feature-icon" aria-hidden>
                    {feature.icon}
                  </span>
                  <div className="match-feature-text">
                    <h3 className="text-base font-semibold text-text-primary">{t(feature.titleKey)}</h3>
                    <p className="text-sm text-text-secondary">{t(feature.descKey)}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </MarketingSection>

        <MarketingSection padding="lg">
          <div className="glass-text-section">
            <div className="section-title">{t("how_label")}</div>
            <div className="section-headline">{t("how_title")}</div>
            <div className="section-body">
              {HOW_STEPS.map((step, idx) => (
                <p key={step}>
                  <strong>
                    {idx + 1}. {t(`${step}_title`)}
                  </strong>
                  <br />
                  {t(`${step}_desc`)}
                </p>
              ))}
            </div>
          </div>
        </MarketingSection>

        <MarketingSection title={t("use_cases_title")} padding="lg">
          <div className="marketing-accent-grid md:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((item) => (
              <GlassCard key={item.titleKey} padding="md" variant="subtle">
                <span className="mb-2 block text-xl" aria-hidden>
                  {item.icon}
                </span>
                <h4 className="text-base font-semibold text-text-primary">{t(item.titleKey)}</h4>
                <p className="mt-2 text-sm text-text-secondary">{t(item.descKey)}</p>
              </GlassCard>
            ))}
          </div>
        </MarketingSection>

        <MarketingSection title={t("whatyouget_title")} padding="lg">
          <GlassCard padding="lg" variant="elevated" className="mx-auto max-w-md">
            <div className="report-preview">
              {REPORT_PREVIEW.map((item) => (
                <div key={item.titleKey} className="preview-item">
                  <span className={`preview-badge ${item.badgeClass}`}>{item.badge}</span>
                  <div className="preview-content">
                    <h4>{t(item.titleKey)}</h4>
                    <p>{t(item.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </MarketingSection>

        <MarketingSection padding="lg">
          <GlassCard padding="lg" variant="elevated" className="pricing-section mx-auto max-w-md text-center">
            <div className="price-tag" style={{ color: "var(--color-match)" }}>
              $4.99
            </div>
            <div className="price-unit">{t("per_reading")}</div>
            <div className="price-divider" />
            <ul className="price-includes">
              {PRICE_INCLUDES.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleStart}
              className="glass-btn glass-btn-primary glass-btn-large mt-8 w-full"
            >
              {ctaLabel}
            </button>
            {canFree ? <p className="first-free-note">{t("first_free_emphasized")}</p> : null}
          </GlassCard>
        </MarketingSection>

        <MarketingSection title={t("not_title")} padding="lg">
          <GlassCard padding="lg" variant="subtle" className="mx-auto max-w-2xl">
            <ul className="space-y-3 text-sm text-text-secondary">
              {(t.raw("not_items") as string[]).map((item) => (
                <li key={item}>
                  <span className="mr-2 text-text-dim">✗</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-text-body">{t("not_footer")}</p>
          </GlassCard>
        </MarketingSection>

        <MarketingSection title={t("faq_title")} padding="lg">
          <div className="match-faq-wrap">
            <div className="faq-list">
              {FAQ_ITEMS.map((item) => (
                <details key={item.q} className="faq-item">
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
