import { SyncroEnergyBall } from "@/components/syncro/syncro-energy-ball";
import { SyncroPwaInstallTrigger } from "@/components/syncro/SyncroPwaInstallGuide";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { AppModeHeroActions } from "@/components/pwa/AppModeHeroActions";
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

export type SyncroProductHeroCopy = {
  brandTag: string;
  heading: string;
  description: string;
  tagline?: string;
  cta: string;
  billingNotice: string;
};

export function SyncroProductHero({ copy }: { copy: SyncroProductHeroCopy }) {
  return (
    <ProductMarketingHero
      theme="syncro"
      background={
        <SyncroEnergyBall variant="hero" initialZoom={0.82} className="syncro-hero-spline" />
      }
    >
      <ProductHeroContent>
        <ProductHeroBrandTag>{copy.brandTag}</ProductHeroBrandTag>
        <DsGradientTitle from="#5eead4" to="#22d3ee">
          {copy.heading}
        </DsGradientTitle>
        <ProductHeroDescription>{copy.description}</ProductHeroDescription>
        {copy.tagline ? (
          <ProductHeroAccent>
            <HeroInlineBold text={copy.tagline} />
          </ProductHeroAccent>
        ) : null}
        <ProductHeroActions>
          <NotPWA>
            <SyncroPwaInstallTrigger
              variant="button"
              className="pj-pill-outline pj-pill-outline--cyan inline-flex px-[30px] py-3.5 text-[15px]"
            >
              {copy.cta}
            </SyncroPwaInstallTrigger>
            {copy.billingNotice ? <ProductHeroBillingNotice>{copy.billingNotice}</ProductHeroBillingNotice> : null}
          </NotPWA>
          <AppModeHeroActions productId="syncro" price="$4.99" />
        </ProductHeroActions>
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
