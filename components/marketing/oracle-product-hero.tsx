import type { ReactNode } from "react";

import { HeroSpline } from "@/components/marketing/hero-spline";
import {
  ProductHeroActions,
  ProductHeroAccent,
  ProductHeroContent,
  ProductHeroDescription,
  ProductHeroMeta,
  ProductHeroTitle,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";
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
          initialZoom={0.92}
          className="absolute left-1/2 top-1/2 h-[460px] w-[108%] -translate-x-1/2 -translate-y-1/2 opacity-75 sm:h-[560px] md:h-[660px]"
        />
      }
    >
      <ProductHeroContent>
        <ProductHeroTitle>{copy.heading}</ProductHeroTitle>
        <ProductHeroAccent>{copy.subtitle}</ProductHeroAccent>
        <ProductHeroDescription>{copy.description}</ProductHeroDescription>
        <ProductHeroMeta>{copy.footnote}</ProductHeroMeta>
        <ProductHeroActions>
          {cta ?? (
            <PwaInlineOpenLink
              href="/start?next=%2Fglyph%2Freading"
              frameTitle="Glyph"
              closeLabel="关闭"
              className="marketing-pill-outline-cta marketing-pill-outline-cta--amber inline-flex min-w-[200px] px-8 py-3.5 text-[15px] hover:-translate-y-0.5 hover:scale-[1.04] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] md:px-10 md:py-4 md:text-base"
            >
              {copy.cta}
            </PwaInlineOpenLink>
          )}
          <p className="product-hero__cta-subline">{copy.ctaSubline}</p>
        </ProductHeroActions>
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
