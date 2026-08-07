import type { Metadata } from "next";

import { NotPWA } from "@/components/pwa/PWAConditional";
import { AppModeProductTopBar } from "@/components/pwa/AppModeProductTopBar";
import { SyncroMarketingBody } from "@/components/marketing/syncro-marketing-body";
import {
  MarketingPageLayout,
  MarketingPageSections,
} from "@/components/marketing/marketing-page-layout";
import { SyncroPwaInstallProvider } from "@/components/syncro/SyncroPwaInstallGuide";

export const syncroMarketingMetadata: Metadata = {
  title: "Syncro — Eastern OS",
  description:
    "See your natural rhythms. First Syncro free, then $4.99 per 24-hour window — mobile only.",
};

/** Syncro marketing page — phone preview + side copy only. */
export async function SyncroMarketingPage() {
  return (
    <SyncroPwaInstallProvider>
      <MarketingPageLayout theme="syncro" component="div">
        <AppModeProductTopBar />
        <MarketingPageSections>
          <NotPWA>
            <SyncroMarketingBody />
          </NotPWA>
        </MarketingPageSections>
      </MarketingPageLayout>
    </SyncroPwaInstallProvider>
  );
}
