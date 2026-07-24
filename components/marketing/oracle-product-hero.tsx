import type { ReactNode } from "react";

import { HeroSpline } from "@/components/marketing/hero-spline";
import { DsGradientTitle } from "@/components/ds/primitives";

import "@/styles/spline-interactive.css";
import {
  HeroInlineBold,
  ProductHeroAccent,
  ProductHeroActions,
  ProductHeroBillingNotice,
  ProductHeroBrandTag,
  ProductHeroContent,
  ProductHeroDescription,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { AppModeHeroActions } from "@/components/pwa/AppModeHeroActions";
import { PwaInlineOpenLink } from "@/components/marketing/pwa-inline-open-link";

export type OracleProductHeroCopy = {
  brandTag: string;
  heading: string;
  description: string;
  tagline?: string;
  cta: string;
  billingNotice: string;
};

export function OracleProductHero({
  copy,
  cta,
  hideActions = false,
}: {
  copy: OracleProductHeroCopy;
  cta?: ReactNode;
  /** Workspace center: no CTA / billing strip */
  hideActions?: boolean;
}) {
  return (
    <ProductMarketingHero
      theme="glyph"
      background={
        <HeroSpline
          scene="/animations/BAOZHAscene.splinecode"
          initialZoom={0.66}
          className="glyph-hero-spline"
          pointerFollow
        />
      }
    >
      <ProductHeroContent>
        <ProductHeroBrandTag>{copy.brandTag}</ProductHeroBrandTag>
        <DsGradientTitle from="#a78bfa" to="#d8b4fe">
          {copy.heading}
        </DsGradientTitle>
        <ProductHeroDescription>{copy.description}</ProductHeroDescription>
        {copy.tagline ? (
          <ProductHeroAccent>
            <HeroInlineBold text={copy.tagline} />
          </ProductHeroAccent>
        ) : null}
        {hideActions ? null : (
          <ProductHeroActions>
            {cta ?? (
              <NotPWA>
                <PwaInlineOpenLink
                  href="/start?next=%2Fglyph%2Freading"
                  frameTitle="Glyph"
                  closeLabel="关闭"
                  className="pj-pill-outline pj-pill-outline--violet inline-flex px-[30px] py-3.5 text-[15px]"
                >
                  {copy.cta}
                </PwaInlineOpenLink>
              </NotPWA>
            )}
            {copy.billingNotice ? (
              <ProductHeroBillingNotice>{copy.billingNotice}</ProductHeroBillingNotice>
            ) : null}
            <AppModeHeroActions productId="glyph" price="$4.99" />
          </ProductHeroActions>
        )}
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
