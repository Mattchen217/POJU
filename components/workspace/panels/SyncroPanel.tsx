"use client";

import { SyncroMarketingBody } from "@/components/marketing/syncro-marketing-body";
import { SyncroPwaInstallProvider } from "@/components/syncro/SyncroPwaInstallGuide";

/**
 * Workspace Syncro tab — phone mockup + side copy only.
 */
export function SyncroPanel() {
  return (
    <SyncroPwaInstallProvider>
      <div className="workspace-product-stack workspace-poju-stack workspace-syncro-stack">
        <div className="workspace-product-below workspace-syncro-below">
          <SyncroMarketingBody />
        </div>
      </div>
    </SyncroPwaInstallProvider>
  );
}
