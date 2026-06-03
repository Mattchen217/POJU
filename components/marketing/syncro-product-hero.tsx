import { SyncroEnergyBall } from "@/components/syncro/syncro-energy-ball";
import { SyncroPwaInstallTrigger } from "@/components/syncro/SyncroPwaInstallGuide";
import {
  ProductHeroAccent,
  ProductHeroContent,
  ProductHeroDescription,
  ProductHeroMeta,
  ProductHeroTitle,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";

export type SyncroProductHeroCopy = {
  heading: string;
  subtitle: string;
  description: string;
  tagline: string;
  footnote: string;
};

export function SyncroProductHero({ copy }: { copy: SyncroProductHeroCopy }) {
  return (
    <ProductMarketingHero
      theme="syncro"
      background={
        <SyncroEnergyBall
          variant="hero"
          initialZoom={1.05}
          className="absolute left-1/2 top-1/2 h-[600px] w-[132%] -translate-x-1/2 -translate-y-1/2 opacity-80 sm:h-[700px] md:h-[860px]"
        />
      }
    >
      <ProductHeroContent>
        <ProductHeroTitle>{copy.heading}</ProductHeroTitle>
        <ProductHeroAccent>{copy.subtitle}</ProductHeroAccent>
        <ProductHeroDescription>{copy.description}</ProductHeroDescription>
        <ProductHeroMeta bright className="!text-text-secondary">
          {copy.tagline}
        </ProductHeroMeta>
        <SyncroPwaInstallTrigger>{copy.footnote}</SyncroPwaInstallTrigger>
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
