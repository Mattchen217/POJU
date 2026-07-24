import { MatchSplineScene } from "@/components/match/MatchSplineScene";
import { DsGradientTitle } from "@/components/ds/primitives";
import {
  ProductHeroActions,
  ProductHeroBillingNotice,
  ProductHeroBrandTag,
  ProductHeroContent,
  ProductHeroDescription,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { AppModeHeroActions } from "@/components/pwa/AppModeHeroActions";

export type MatchProductHeroCopy = {
  brandTag: string;
  heading: string;
  description: string;
  cta: string;
  billingNotice: string;
};

const MATCH_CTA_CLASS =
  "pj-pill-outline pj-pill-outline--rose inline-flex px-[30px] py-3.5 text-[15px]";

export function MatchProductHero({
  copy,
  hideActions = false,
  onCtaClick,
}: {
  copy: MatchProductHeroCopy;
  /** Workspace center: no CTA / billing strip */
  hideActions?: boolean;
  onCtaClick?: () => void;
}) {
  return (
    <ProductMarketingHero
      theme="match"
      backgroundClassName="product-hero__bg--match"
      background={<MatchSplineScene variant="hero" className="match-hero-spline" pointerFollow={false} />}
    >
      <ProductHeroContent>
        <ProductHeroBrandTag>{copy.brandTag}</ProductHeroBrandTag>
        <DsGradientTitle from="#ff6b9d" to="#ffb3c7">
          {copy.heading}
        </DsGradientTitle>
        <ProductHeroDescription>{copy.description}</ProductHeroDescription>
        {hideActions ? null : (
          <ProductHeroActions>
            <NotPWA>
              <button type="button" onClick={onCtaClick} className={MATCH_CTA_CLASS}>
                {copy.cta}
              </button>
              {copy.billingNotice ? (
                <ProductHeroBillingNotice>{copy.billingNotice}</ProductHeroBillingNotice>
              ) : null}
            </NotPWA>
            <AppModeHeroActions productId="match" price="$4.99" />
          </ProductHeroActions>
        )}
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
