"use client";

import { useEffect, useState } from "react";
import {
  Award,
  Briefcase,
  Coffee,
  Compass,
  Heart,
  Home,
  Link2,
  User,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";
import {
  DsBand,
  DsGlassCard,
  DsGradientTitle,
  DsIconChip,
  DsKicker,
  DsMutedCard,
  DsSectionHeading,
} from "@/components/ds/primitives";
import { DsMatchUseCard } from "@/components/ds/marketing/DsProductFlows";
import { MatchHowWorksSection } from "@/components/match/MatchHowWorksSection";
import { ProductPricingSection } from "@/components/marketing/product-pricing-section";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { PWAProductBeginCTA } from "@/components/pwa/PWAProductBeginCTA";
import {
  MarketingPageHero,
  MarketingPageLayout,
  MarketingPageSections,
} from "@/components/marketing/marketing-page-layout";
import {
  ProductHeroAccent,
  ProductHeroActions,
  ProductHeroContent,
  ProductHeroDescription,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";
import { ProductWhatIsSection } from "@/components/marketing/product-what-is-section";
import { MatchSplineScene } from "@/components/match/MatchSplineScene";
import { PojuToolHandoffBanner } from "@/components/poju/PojuToolHandoffBanner";
import { useRouter } from "@/i18n/navigation";
import { usePojuToolHandoff } from "@/lib/poju/use-poju-tool-handoff";
import { isFirstTimeFree } from "@/lib/syncro/device-usage";

const FEATURE_KEYS = [
  "feature_two_charts_title",
  "feature_any_relationship_title",
  "feature_5_sections_title",
] as const;
const FEATURE_DESC_KEYS = [
  "feature_two_charts_desc",
  "feature_any_relationship_desc",
  "feature_5_sections_desc",
] as const;

const HOW_STEPS = ["how_step_1", "how_step_2", "how_step_3", "how_step_4"] as const;

const USE_CASES = [
  { titleKey: "use_case_marriage_title", descKey: "use_case_marriage_desc", icon: Heart },
  { titleKey: "use_case_partnership_title", descKey: "use_case_partnership_desc", icon: Briefcase },
  { titleKey: "use_case_family_title", descKey: "use_case_family_desc", icon: Home },
  { titleKey: "use_case_hiring_title", descKey: "use_case_hiring_desc", icon: Users },
  { titleKey: "use_case_relationship_title", descKey: "use_case_relationship_desc", icon: Link2 },
  { titleKey: "use_case_friendship_title", descKey: "use_case_friendship_desc", icon: Coffee },
] as const;

const REPORT_PREVIEW = [
  { badge: "A", titleKey: "preview_a_title", descKey: "preview_a_desc", icon: User },
  { badge: "B", titleKey: "preview_b_title", descKey: "preview_b_desc", icon: User },
  { badge: "×", titleKey: "preview_combined_title", descKey: "preview_combined_desc", icon: Users },
  { badge: "◎", titleKey: "preview_conclusion_title", descKey: "preview_conclusion_desc", icon: Award },
  { badge: "→", titleKey: "preview_actions_title", descKey: "preview_actions_desc", icon: Compass },
] as const;

const PRICE_INCLUDES = ["include_1", "include_2", "include_3", "include_4", "include_5"] as const;
const FAQ_ITEMS = [
  { q: "faq_q1", a: "faq_a1" },
  { q: "faq_q2", a: "faq_a2" },
  { q: "faq_q3", a: "faq_a3" },
  { q: "faq_q4", a: "faq_a4" },
] as const;

const MATCH_CTA_CLASS =
  "pj-pill-outline pj-pill-outline--rose inline-flex min-w-[220px] justify-center px-8 py-3.5 text-[15px] font-semibold md:px-10 md:py-4 md:text-base";

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

      <MarketingPageHero>
        <ProductMarketingHero
          theme="match"
          backgroundClassName="product-hero__bg--match"
          background={<MatchSplineScene variant="hero" className="match-hero-spline" pointerFollow={false} />}
        >
          <ProductHeroContent>
            <DsGradientTitle from="#ff6b9d" to="#ffb3c7" spaced>
              Match
            </DsGradientTitle>
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
      </MarketingPageHero>

      <MarketingPageSections>
        <ProductWhatIsSection product="match" />

        <NotPWA>
          <DsBand>
            <div className="ds-grid-auto-240">
              {FEATURE_KEYS.map((titleKey, i) => (
                <DsGlassCard key={titleKey} roseGlow>
                  <p className="ds-glass-card__title--rose">{t(titleKey)}</p>
                  <p className="ds-glass-card__body">{t(FEATURE_DESC_KEYS[i])}</p>
                </DsGlassCard>
              ))}
            </div>
          </DsBand>

          <DsBand className="match-how-works-band">
            <MatchHowWorksSection
              header={
                <>
                  <DsKicker color="#ffb3c7">{t("how_label")}</DsKicker>
                  <DsSectionHeading className="mt-2">{t("how_title")}</DsSectionHeading>
                </>
              }
              steps={HOW_STEPS.map((step) => ({
                title: t(`${step}_title`),
                desc: t(`${step}_desc`),
              }))}
            />
          </DsBand>

          <DsBand>
            <DsSectionHeading>{t("use_cases_title")}</DsSectionHeading>
            <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {USE_CASES.map(({ titleKey, descKey, icon: Icon }, idx) => (
                <DsMatchUseCard
                  key={titleKey}
                  index={idx + 1}
                  icon={<Icon className="h-5 w-5" strokeWidth={2} aria-hidden />}
                  title={t(titleKey)}
                  description={t(descKey)}
                />
              ))}
            </div>
          </DsBand>

          <DsBand>
            <DsSectionHeading>{t("whatyouget_title")}</DsSectionHeading>
            <div className="ds-grid-auto-240 ds-mt-36">
              {REPORT_PREVIEW.map(({ badge, titleKey, descKey, icon: Icon }) => (
                <DsGlassCard key={titleKey}>
                  <div className="ds-glass-card__row">
                    <DsIconChip>
                      <Icon className="h-5 w-5 text-[#ffd0de]" strokeWidth={2} />
                    </DsIconChip>
                    <div>
                      <p className="text-xs font-mono text-[#ffb3c7]">{badge}</p>
                      <p className="ds-glass-card__title mt-1">{t(titleKey)}</p>
                      <p className="ds-glass-card__body">{t(descKey)}</p>
                    </div>
                  </div>
                </DsGlassCard>
              ))}
              <DsMutedCard accent="rose" className="flex flex-col justify-center">
                <p className="m-0 text-[13px] uppercase tracking-[0.12em] opacity-90">
                  {t("whatyouget_title")}
                </p>
                <ul className="mt-3 list-none space-y-2 p-0">
                  {PRICE_INCLUDES.map((key) => (
                    <li key={key} className="flex gap-2 text-[13.5px] leading-snug">
                      <span>✓</span>
                      {t(key)}
                    </li>
                  ))}
                </ul>
              </DsMutedCard>
            </div>
            <p className="mx-auto mt-8 max-w-xl text-center text-[17px] text-white">
              {effectiveFree ? t("first_free_emphasized") : heroNote}
            </p>
          </DsBand>

          <DsBand>
            <DsSectionHeading>{t("faq_title")}</DsSectionHeading>
            <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-3.5">
              {FAQ_ITEMS.map(({ q, a }) => (
                <DsGlassCard key={q}>
                  <p className="ds-glass-card__title">{t(q)}</p>
                  <p className="ds-glass-card__body mt-2.5">{t(a)}</p>
                </DsGlassCard>
              ))}
            </div>
          </DsBand>

          <ProductPricingSection
            product="match"
            matchCtaLabel={ctaLabel}
            onMatchStart={handleStart}
          />
        </NotPWA>
      </MarketingPageSections>

      <PWAProductBeginCTA productId="match" price="$4.99" />
    </MarketingPageLayout>
  );
}
