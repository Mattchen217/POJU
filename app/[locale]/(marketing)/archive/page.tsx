import type { Metadata } from "next";

import { ArchiveActionPlansList } from "@/components/archive/archive-action-plans-list";
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
            <ArchiveRuntimePreview />
          </div>

          <div className="mt-16 text-center md:text-left">
            <WipeEverythingButton />
          </div>

          <nav className="fixed bottom-0 left-0 z-40 flex w-full items-center justify-around rounded-t-2xl border-t border-white/10 bg-[#1E1E22]/60 px-4 pb-6 pt-3 backdrop-blur-2xl md:hidden">
            <a className="flex flex-col items-center justify-center px-3 py-1 text-white/30 transition-all hover:bg-white/5" href="#">
              <span className="material-symbols-outlined mb-1">inventory_2</span>
              <span className="font-['Manrope'] text-[10px] font-medium uppercase tracking-tight">Vault</span>
            </a>
            <a className="flex flex-col items-center justify-center px-3 py-1 text-white/30 transition-all hover:bg-white/5" href="#">
              <span className="material-symbols-outlined mb-1">auto_awesome</span>
              <span className="font-['Manrope'] text-[10px] font-medium uppercase tracking-tight">Glyph</span>
            </a>
            <a className="flex flex-col items-center justify-center px-3 py-1 text-white/30 transition-all hover:bg-white/5" href="#">
              <span className="material-symbols-outlined mb-1">sync</span>
              <span className="font-['Manrope'] text-[10px] font-medium uppercase tracking-tight">Sync</span>
            </a>
            <a
              className="flex scale-105 flex-col items-center justify-center rounded-xl bg-violet-500/10 px-3 py-1 text-violet-400 duration-200"
              href="#"
            >
              <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>
                archive
              </span>
              <span className="font-['Manrope'] text-[10px] font-medium uppercase tracking-tight">Archive</span>
            </a>
          </nav>
        </MarketingSection>
      </MarketingPageSections>
    </MarketingPageLayout>
  );
}
