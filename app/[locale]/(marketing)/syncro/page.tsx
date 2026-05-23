import { Suspense } from "react";

import { SyncroMarketingPage, syncroMarketingMetadata } from "@/components/marketing/syncro-marketing-page";
import { SyncroPageLayout } from "@/components/syncro/SyncroPageLayout";

export const dynamic = "force-dynamic";

export const metadata = syncroMarketingMetadata;

export default function SyncroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-deep" />}>
      <SyncroPageLayout marketing={<SyncroMarketingPage />} />
    </Suspense>
  );
}
