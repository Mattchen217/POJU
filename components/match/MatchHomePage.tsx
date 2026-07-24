"use client";

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
  DsIconChip,
  DsKicker,
  DsMutedCard,
  DsSectionHeading,
} from "@/components/ds/primitives";
import { DsMatchUseCard } from "@/components/ds/marketing/DsProductFlows";
import { MatchHowWorksSection } from "@/components/match/MatchHowWorksSection";
import { MatchProductHero } from "@/components/marketing/match-product-hero";
import { ProductPricingSection } from "@/components/marketing/product-pricing-section";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { AppModeDesktopHint } from "@/components/pwa/AppModeDesktopHint";
import { AppModeProductTopBar } from "@/components/pwa/AppModeProductTopBar";
import {
  MarketingPageHero,
  MarketingPageLayout,
  MarketingPageSections,
} from "@/components/marketing/marketing-page-layout";
import { ProductWhatIsSection } from "@/components/marketing/product-what-is-section";
import { PojuToolHandoffBanner } from "@/components/poju/PojuToolHandoffBanner";
import { useRouter } from "@/i18n/navigation";
import { usePojuToolHandoff } from "@/lib/poju/use-poju-tool-handoff";

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

export function MatchHomePage() {
  const router = useRouter();
  const t = useTranslations("match.home");

  const pojuHandoff = usePojuToolHandoff("match");

  function handleStart() {
    sessionStorage.setItem("match_session_type", "free");
    if (pojuHandoff?.prefill.partner_relationship) {
      sessionStorage.setItem("match_relationship_prefill", pojuHandoff.prefill.partner_relationship);
    }
    router.push("/match/select-a");
  }

  const heroCopy = {
    brandTag: t("brand_tag"),
    heading: t("heading"),
    description: t("description"),
    cta: t("cta"),
    billingNotice: t("billing_notice"),
  };

  return (
    <MarketingPageLayout theme="match" className="match-home">
      <AppModeProductTopBar />
      <NotPWA>
      <div className="w-full px-3 sm:px-4 md:px-6">
        <ArchiveReturnBanner />
        {pojuHandoff ? <PojuToolHandoffBanner handoff={pojuHandoff} className="mt-4" /> : null}
      </div>
      </NotPWA>

      <MarketingPageHero>
        <MatchProductHero copy={heroCopy} onCtaClick={handleStart} />
      </MarketingPageHero>
      <AppModeDesktopHint />

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
              {t("billing_notice")}
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
            matchCtaLabel={t("cta")}
            onMatchStart={handleStart}
          />
        </NotPWA>
      </MarketingPageSections>
    </MarketingPageLayout>
  );
}
