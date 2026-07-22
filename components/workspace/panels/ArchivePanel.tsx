"use client";

import { Link } from "@/i18n/navigation";

export function ArchivePanel() {
  return (
    <div className="workspace-panel">
      <h2 className="workspace-panel__headline">Your past readings, kept on this device.</h2>
      <p className="workspace-panel__guidance">
        Open the Archive vault to browse reports and sessions you have already generated.
      </p>
      <div className="workspace-glass-card flex flex-col items-start gap-4">
        <p className="m-0 text-sm text-[var(--ws-text-secondary,#9a9cae)]">
          Archive uses the existing vault — no data is moved to the server.
        </p>
        <Link href="/archive" className="workspace-link-btn">
          Open Archive
        </Link>
      </div>
    </div>
  );
}
