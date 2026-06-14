import type { ReactNode } from "react";

import { HeroSpline } from "@/components/marketing/hero-spline";
import { DsGradientTitle } from "@/components/ds/primitives";

import "@/styles/spline-interactive.css";
import {
  ProductHeroActions,
  ProductHeroAccent,
  ProductHeroContent,
  ProductHeroDescription,
  ProductHeroMeta,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { AppModeHeroActions } from "@/components/pwa/AppModeHeroActions";
import { PwaInlineOpenLink } from "@/components/marketing/pwa-inline-open-link";

export type OracleProductHeroCopy = {
  heading: string;
  subtitle: string;
  description: string;
  footnote: string;
  cta: string;
  ctaSubline: string;
};

export function OracleProductHero({
  copy,
  cta,
}: {
  copy: OracleProductHeroCopy;
  cta?: ReactNode;
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
        <DsGradientTitle from="#a78bfa" to="#d8b4fe">
          {copy.heading}
        </DsGradientTitle>
        <ProductHeroAccent>{copy.subtitle}</ProductHeroAccent>
        <ProductHeroDescription>{copy.description}</ProductHeroDescription>
        <ProductHeroMeta>{copy.footnote}</ProductHeroMeta>
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
          <NotPWA>
            <p className="product-hero__cta-subline">{copy.ctaSubline}</p>
          </NotPWA>
          <AppModeHeroActions productId="glyph" price="$4.99" />
        </ProductHeroActions>
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
