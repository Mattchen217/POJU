import { SyncroEnergyBall } from "@/components/syncro/syncro-energy-ball";
import { SyncroPwaInstallTrigger } from "@/components/syncro/SyncroPwaInstallGuide";
import { DsGradientTitle } from "@/components/ds/primitives";
import {
  ProductHeroAccent,
  ProductHeroActions,
  ProductHeroContent,
  ProductHeroDescription,
  ProductHeroMeta,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";

export type SyncroProductHeroCopy = {
  heading: string;
  subtitle: string;
  description: string;
  tagline: string;
  footnote: string;
  cta: string;
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
        <DsGradientTitle from="#5eead4" to="#22d3ee" spaced>
          {copy.heading}
        </DsGradientTitle>
        <ProductHeroAccent>{copy.subtitle}</ProductHeroAccent>
        <ProductHeroDescription>{copy.description}</ProductHeroDescription>
        <ProductHeroMeta bold>{copy.tagline}</ProductHeroMeta>
        <ProductHeroMeta>{copy.footnote}</ProductHeroMeta>
        <ProductHeroActions>
          <SyncroPwaInstallTrigger
            variant="button"
            className="pj-pill-outline pj-pill-outline--cyan inline-flex px-[30px] py-3.5 text-[15px]"
          >
            {copy.cta}
          </SyncroPwaInstallTrigger>
        </ProductHeroActions>
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
