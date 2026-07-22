"use client";

import type { WorkspaceTab } from "@/lib/ui-shell/resolve-ui-shell";
import { WORKSPACE_TAB_LABELS } from "@/lib/ui-shell/resolve-ui-shell";

const ENGINE_ITEMS: { tab: WorkspaceTab; icon: string }[] = [
  { tab: "atmos", icon: "blur_on" },
  { tab: "poju", icon: "self_improvement" },
  { tab: "match", icon: "group" },
  { tab: "syncro", icon: "bolt" },
  { tab: "glyph", icon: "diamond" },
];

const BOTTOM_ITEMS: { tab: WorkspaceTab | "legal"; icon: string; label: string }[] = [
  { tab: "archive", icon: "folder_open", label: WORKSPACE_TAB_LABELS.archive },
  { tab: "profile", icon: "person", label: WORKSPACE_TAB_LABELS.profile },
  { tab: "legal", icon: "gavel", label: "Legal" },
];

type Props = {
  activeTab: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
  onOpenLegal: () => void;
};

export function WorkspaceSidebar({ activeTab, onSelect, onOpenLegal }: Props) {
  return (
    <div className="workspace-sidebar">
      <div className="workspace-sidebar__brand">
        <span className="workspace-sidebar__brand-mark" aria-hidden />
        <span className="workspace-sidebar__brand-title">POJULIFE</span>
      </div>

      <nav className="workspace-sidebar__nav" aria-label="Workspace engines">
        {ENGINE_ITEMS.map(({ tab, icon }) => (
          <button
            key={tab}
            type="button"
            className="workspace-sidebar__item"
            aria-current={activeTab === tab ? "page" : undefined}
            onClick={() => onSelect(tab)}
          >
            <span className="material-symbols-outlined workspace-sidebar__icon" aria-hidden>
              {icon}
            </span>
            {WORKSPACE_TAB_LABELS[tab]}
          </button>
        ))}

        <div className="workspace-sidebar__divider" role="separator" />

        <div className="workspace-sidebar__bottom">
          {BOTTOM_ITEMS.map((item) => (
            <button
              key={item.tab}
              type="button"
              className="workspace-sidebar__item"
              aria-current={item.tab !== "legal" && activeTab === item.tab ? "page" : undefined}
              onClick={() => {
                if (item.tab === "legal") onOpenLegal();
                else onSelect(item.tab);
              }}
            >
              <span className="material-symbols-outlined workspace-sidebar__icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
