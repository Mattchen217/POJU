"use client";

import { Link } from "@/i18n/navigation";

import { WorkspaceAccountPlaceholder } from "@/components/workspace/WorkspaceAccountPlaceholder";
import { WorkspaceProfileSlotBar } from "@/components/workspace/WorkspaceProfileSlotBar";

export function ProfilePanel() {
  return (
    <div className="workspace-panel">
      <h2 className="workspace-panel__headline">Profiles and account.</h2>
      <p className="workspace-panel__guidance">
        Manage birth-chart slots here. Sign-in will land in the account area when registration ships.
      </p>

      <div className="workspace-glass-card mb-4 flex flex-col gap-4">
        <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#5f627a)]">
          Account (coming soon)
        </p>
        <WorkspaceAccountPlaceholder />
        <p className="m-0 text-sm text-[var(--ws-text-secondary,#9a9cae)]">
          Avatar, display name, and email are reserved. No login required today.
        </p>
      </div>

      <div className="workspace-glass-card flex flex-col gap-4">
        <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#5f627a)]">
          Chart slots
        </p>
        <WorkspaceProfileSlotBar showAddAffordance />
        <Link href="/profile/setup" className="workspace-link-btn self-start">
          Set up or edit a profile
        </Link>
      </div>
    </div>
  );
}
