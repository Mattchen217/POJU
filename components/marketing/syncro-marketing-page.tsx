import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ArchiveReturnBanner } from "@/components/archive/archive-return-banner";
import { NotPWA } from "@/components/pwa/PWAConditional";
import { AppModeDesktopHint } from "@/components/pwa/AppModeDesktopHint";
import { AppModeProductTopBar } from "@/components/pwa/AppModeProductTopBar";
import { SyncroMarketingBody } from "@/components/marketing/syncro-marketing-body";
import {
  MarketingPageHero,
  MarketingPageLayout,
  MarketingPageSections,
} from "@/components/marketing/marketing-page-layout";
import { SyncroProductHero } from "@/components/marketing/syncro-product-hero";
import { SyncroPwaInstallProvider } from "@/components/syncro/SyncroPwaInstallGuide";

export const syncroMarketingMetadata: Metadata = {
  title: "Syncro — Eastern OS",
  description:
    "See your natural rhythms. First Syncro free, then $4.99 per 24-hour window — mobile only.",
};

export async function SyncroMarketingPage() {
  const t = await getTranslations("marketingSite.syncro");

  const heroCopy = {
    brandTag: t("hero.brand_tag"),
    heading: t("hero.heading"),
    description: t("hero.description"),
    tagline: t.has("hero.tagline") ? t("hero.tagline") : undefined,
    cta: t("hero.cta"),
    billingNotice: t("hero.billing_notice"),
  };

  return (
    <SyncroPwaInstallProvider>
      <MarketingPageLayout theme="syncro" component="div">
        <AppModeProductTopBar />
        <MarketingPageHero>
          <NotPWA>
            <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
              <ArchiveReturnBanner />
            </div>
          </NotPWA>
          <SyncroProductHero copy={heroCopy} />
        </MarketingPageHero>
        <AppModeDesktopHint />

        <MarketingPageSections>
          <NotPWA>
            <SyncroMarketingBody />
          </NotPWA>
        </MarketingPageSections>
      </MarketingPageLayout>
    </SyncroPwaInstallProvider>
  );
}
