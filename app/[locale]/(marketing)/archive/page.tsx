import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ArchiveProductHero } from "@/components/marketing/archive-product-hero";
import { DsArchiveVaultGrid } from "@/components/ds/DsArchiveVaultGrid";
import { DsPageStack } from "@/components/ds/primitives";
import { MarketingPageLayout } from "@/components/marketing/marketing-page-layout";

export const metadata: Metadata = {
  title: "The Archive — pojulife",
  description:
    "Everything here lives only on this device. Your POJU sessions, Glyph reflections, and Syncro readings in one local vault.",
};

export default async function ArchivePage() {
  const t = await getTranslations("archiveVault");

  return (
    <MarketingPageLayout theme="poju">
      <ArchiveProductHero
        copy={{
          title: t("title"),
          subtitle: t("hero_subtitle"),
          encryptedNote: t("encrypted_note"),
        }}
      />

      <DsPageStack className="px-3 sm:px-4 md:px-6">
        <DsArchiveVaultGrid />
      </DsPageStack>
    </MarketingPageLayout>
  );
}
