import type { Metadata } from "next";

import { ArchiveActionPlansList } from "@/components/archive/archive-action-plans-list";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { ArchiveRuntimePreview } from "@/components/archive/archive-runtime-preview";
import { WipeEverythingButton } from "@/components/archive/wipe-everything-button";
import { MarketingPageLayout, MarketingPageSections } from "@/components/marketing/marketing-page-layout";
import { MarketingSection } from "@/components/marketing/marketing-section";
import {
  ProductHeroContent,
  ProductHeroDescription,
  ProductHeroTitle,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";

export const metadata: Metadata = {
  title: "The Archive — pojulife",
  description:
    "Everything here lives only on this device. Your POJU sessions, Glyph reflections, and Syncro readings in one local vault.",
};

export default function ArchivePage() {
  return (
    <MarketingPageLayout theme="poju">
      <ProductMarketingHero>
        <ProductHeroContent>
          <ProductHeroTitle gradient className="!tracking-[0.06em]">
            ✦ THE ARCHIVE.
          </ProductHeroTitle>
          <ProductHeroDescription className="!text-white/85">
            Everything here lives only on this device.
          </ProductHeroDescription>
        </ProductHeroContent>
      </ProductMarketingHero>

      <MarketingPageSections>
        <MarketingSection padding="lg" allowOverflow>
          <div className="space-y-12">
            <ArchiveActionPlansList />
            <NotPWA>
              <ArchiveRuntimePreview />
            </NotPWA>
          </div>

          <div className="mt-16 text-center md:text-left">
            <WipeEverythingButton />
          </div>
        </MarketingSection>
      </MarketingPageSections>
    </MarketingPageLayout>
  );
}
