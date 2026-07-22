"use client";

import { WorkspaceAccountPlaceholder } from "@/components/workspace/WorkspaceAccountPlaceholder";

type Props = {
  engineTitle: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  menuButtonId?: string;
  drawerId?: string;
};

export function WorkspaceTopBar({
  engineTitle,
  menuOpen,
  onMenuToggle,
  menuButtonId = "workspace-menu-btn",
  drawerId = "workspace-mobile-drawer",
}: Props) {
  return (
    <header className="workspace-topbar">
      <button
        id={menuButtonId}
        type="button"
        className="workspace-topbar__menu-btn"
        aria-label="Open menu"
        aria-expanded={menuOpen}
        aria-controls={drawerId}
        onClick={onMenuToggle}
      >
        <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
          menu
        </span>
      </button>

      <h1 className="workspace-topbar__title">{engineTitle}</h1>

      <WorkspaceAccountPlaceholder compact className="workspace-account-chip--mobile" />

      <div className="workspace-topbar__desktop-meta">
        <WorkspaceAccountPlaceholder />
        <div className="workspace-pass-chip">
          Pass: <strong>Active</strong>
        </div>
      </div>
    </header>
  );
}
