"use client";

import { useTranslations } from "next-intl";

import { SyncroMarketingBody } from "@/components/marketing/syncro-marketing-body";
import { SyncroProductHero } from "@/components/marketing/syncro-product-hero";
import { SyncroPwaInstallProvider } from "@/components/syncro/SyncroPwaInstallGuide";

/**
 * Workspace Syncro tab: hero + phone/copy preview under it.
 */
export function SyncroPanel() {
  const t = useTranslations("marketingSite.syncro");
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
      <div className="workspace-product-stack workspace-poju-stack workspace-syncro-stack">
        <div className="workspace-product-hero workspace-syncro-hero">
          <SyncroProductHero copy={heroCopy} hideActions />
        </div>
        <div className="workspace-product-below workspace-syncro-below">
          <SyncroMarketingBody />
        </div>
      </div>
    </SyncroPwaInstallProvider>
  );
}
