"use client";

import { useTranslations } from "next-intl";

import { DsGlassCard } from "@/components/ds/primitives";
import { GlyphPrepareCta } from "@/components/glyph/GlyphPrepareCta";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { SyncroPricingCta } from "@/components/marketing/syncro-pricing-cta";
import { PojuSessionStarter } from "@/components/poju/poju-session-starter";

export type ProductPricingId = "poju" | "glyph" | "syncro" | "match";

const POJU_CTA_CLASS =
  "pj-pill-outline pj-pill-outline--gold px-[30px] py-3.5 text-[15px] md:px-10 md:py-4 md:text-base";

const MATCH_CTA_CLASS =
  "pj-pill-outline pj-pill-outline--rose inline-flex min-w-[220px] justify-center px-8 py-3.5 text-[15px] font-semibold md:px-10 md:py-4 md:text-base";

type ProductPricingSectionProps = {
  product: ProductPricingId;
  /** Match only — label reflects free vs paid state */
  matchCtaLabel?: string;
  onMatchStart?: () => void;
};

export function ProductPricingSection({ product, matchCtaLabel, onMatchStart }: ProductPricingSectionProps) {
  const ns = product === "match" ? "match.home" : `marketingSite.${product}`;
  const t = useTranslations(ns);
  const features = t.raw("pricing.features") as string[];
  const hasFootnote = t.has("pricing.footnote");
  const ctaLabel = product === "match" ? matchCtaLabel : t("pricing.cta");

  return (
    <MarketingSection id={`${product}-pricing`} title={t("pricing.heading")} padding="lg" center>
      <p className="marketing-section-subheading mx-auto max-w-2xl text-center">{t("pricing.body")}</p>

      <div className={`product-pricing-block product-pricing-block--${product} pricing-section mt-8`}>
        <div className="price-tag">{t("pricing.price")}</div>
        <div className="price-unit">{t("pricing.price_unit")}</div>
      </div>

      {features.length > 0 ? (
        <DsGlassCard className="product-pricing-features mx-auto mt-8 w-full max-w-md text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pj-text-secondary)]">
            {t("pricing.features_heading")}
          </p>
          <ul className="price-includes mt-4">
            {features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </DsGlassCard>
      ) : null}

      <div className="mt-8 flex flex-col items-center gap-3">
        {product === "poju" ? (
          <PojuSessionStarter className={POJU_CTA_CLASS}>{ctaLabel}</PojuSessionStarter>
        ) : product === "glyph" ? (
          <GlyphPrepareCta variant="final" />
        ) : product === "syncro" ? (
          <SyncroPricingCta label={ctaLabel ?? t("pricing.cta")} className="mt-0" />
        ) : (
          <button type="button" onClick={onMatchStart} className={MATCH_CTA_CLASS}>
            {ctaLabel}
          </button>
        )}
        {hasFootnote ? (
          <p className="marketing-section-intro max-w-md text-sm opacity-90">{t("pricing.footnote")}</p>
        ) : null}
      </div>
    </MarketingSection>
  );
}
