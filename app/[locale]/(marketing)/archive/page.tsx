import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ArchiveProductHero, type ArchiveHeroPointIcon } from "@/components/marketing/archive-product-hero";
import { DsArchiveVaultGrid } from "@/components/ds/DsArchiveVaultGrid";
import {
  MarketingPageHero,
  MarketingPageLayout,
  MarketingPageSections,
} from "@/components/marketing/marketing-page-layout";

export const metadata: Metadata = {
  title: "The Archive — pojulife",
  description:
    "Everything here lives only on this device. Your POJU sessions, Glyph reflections, and Syncro readings in one local vault.",
};

export default async function ArchivePage() {
  const t = await getTranslations("archiveVault");
  const heroPoints = t.raw("hero_points") as Array<{ icon: ArchiveHeroPointIcon; text: string }>;

  return (
    <MarketingPageLayout theme="archive">
      <MarketingPageHero>
        <ArchiveProductHero
          copy={{
            title: t("title"),
            intro: t("hero_intro"),
            points: heroPoints,
          }}
        />
      </MarketingPageHero>

      <MarketingPageSections>
        <DsArchiveVaultGrid />
      </MarketingPageSections>
    </MarketingPageLayout>
  );
}
