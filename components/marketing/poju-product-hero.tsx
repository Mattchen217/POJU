import { HeroSpline } from "@/components/marketing/hero-spline";
import {
  ProductHeroAccent,
  ProductHeroActions,
  ProductHeroContent,
  ProductHeroDescription,
  ProductHeroTitle,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { PojuSessionStarter } from "@/components/poju/poju-session-starter";

export type PojuProductHeroCopy = {
  heading: string;
  description: string;
  tagline: string;
  ctaPrimary: string;
};

export function PojuProductHero({ copy }: { copy: PojuProductHeroCopy }) {
  return (
    <ProductMarketingHero
      theme="poju"
      background={
        <HeroSpline
          scene="/animations/POJURENscene.splinecode"
          initialZoom={0.62}
          className="absolute -top-16 left-0 right-0 h-[430px] opacity-75 sm:-top-20 sm:h-[520px] md:-top-28 md:h-[660px]"
        />
      }
    >
      <ProductHeroContent>
        <ProductHeroTitle>{`POJU · ${copy.heading}`}</ProductHeroTitle>
        <ProductHeroDescription>{copy.description}</ProductHeroDescription>
        <ProductHeroAccent>{copy.tagline}</ProductHeroAccent>
        <ProductHeroActions>
          <NotPWA>
            <PojuSessionStarter className="marketing-pill-outline-cta marketing-pill-outline-cta--violet inline-flex w-full min-w-0 px-8 py-3.5 text-[15px] hover:-translate-y-0.5 hover:scale-[1.02] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] sm:w-auto sm:min-w-[220px] md:px-10 md:py-4 md:text-base">
              {copy.ctaPrimary}
            </PojuSessionStarter>
          </NotPWA>
        </ProductHeroActions>
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
