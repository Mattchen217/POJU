import { Lock } from "lucide-react";

import { DsGradientTitle } from "@/components/ds/primitives";
import {
  ProductHeroContent,
  ProductHeroDescription,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";

export type ArchiveProductHeroCopy = {
  title: string;
  subtitle: string;
  encryptedNote: string;
};

/** DS archive.jsx hero — 无动效背景，仅暗角叠层 */
export function ArchiveProductHero({ copy }: { copy: ArchiveProductHeroCopy }) {
  return (
    <ProductMarketingHero theme="archive" shellClassName="product-hero__shell--archive">
      <ProductHeroContent>
        <DsGradientTitle from="#c4b5fd" to="#a78bfa">
          {copy.title}
        </DsGradientTitle>
        <ProductHeroDescription className="max-w-[34rem]">{copy.subtitle}</ProductHeroDescription>
        <p className="product-hero__lock-note">
          <Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {copy.encryptedNote}
        </p>
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
