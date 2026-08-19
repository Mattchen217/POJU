import { HeroSpline } from "@/components/marketing/hero-spline";
import { DsGradientTitle } from "@/components/ds/primitives";
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
import { PojuSessionStarter } from "@/components/poju/poju-session-starter";

export type PojuProductHeroCopy = {
  brandTag: string;
  heading: string;
  description: string;
  tagline: string;
  ctaPrimary: string;
  billingNotice: string;
};

export function PojuProductHero({
  copy,
  hideActions = false,
  scene = "/animations/POJURENscene.splinecode",
  initialZoom = 0.62,
  hideStarrySky = false,
  hideVignette = false,
}: {
  copy: PojuProductHeroCopy;
  /** Workspace center: no CTA / billing strip */
  hideActions?: boolean;
  /** Spline scene URL — Atmos workspace uses `/spline/atmoswork.splinecode` */
  scene?: string;
  initialZoom?: number;
  hideStarrySky?: boolean;
  hideVignette?: boolean;
}) {
  return (
    <ProductMarketingHero
      theme="poju"
      hideStarrySky={hideStarrySky || hideActions}
      hideVignette={hideVignette}
      background={
        <HeroSpline
          scene={scene}
          initialZoom={initialZoom}
          className="poju-hero-spline"
          keepAlive={hideActions}
          renderOnDemand={!hideActions}
        />
      }
    >
      <ProductHeroContent>
        <ProductHeroBrandTag>{copy.brandTag}</ProductHeroBrandTag>
        <DsGradientTitle from="#d4af37" to="#e8c56f">
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
            <NotPWA>
              <PojuSessionStarter className="pj-pill-outline pj-pill-outline--gold px-[30px] py-3.5 text-[15px]">
                {copy.ctaPrimary}
              </PojuSessionStarter>
              {copy.billingNotice ? (
                <ProductHeroBillingNotice>{copy.billingNotice}</ProductHeroBillingNotice>
              ) : null}
            </NotPWA>
            <AppModeHeroActions productId="poju" price="$9.99" />
          </ProductHeroActions>
        )}
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
