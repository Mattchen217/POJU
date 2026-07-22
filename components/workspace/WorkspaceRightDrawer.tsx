"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";
import { WorkspaceSidebarDockToggle } from "@/components/workspace/WorkspaceSidebarDockToggle";
import { isWorkspaceRailInteractiveTarget } from "@/components/workspace/workspace-rail-click";

type Props = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Desktop right drawer — expanded = 3× left sidebar width;
 * collapsed = same as left mini-rail.
 * Click collapsed rail / blank expanded area toggles; controls do not.
 */
export function WorkspaceRightDrawer({ open, onOpen, onClose, children }: Props) {
  const t = useTranslations("workspace.density");

  return (
    <aside
      className={`workspace-shell__right-drawer${open ? " is-open" : " is-collapsed"}`}
      aria-label={t("contextLabel")}
      aria-expanded={open}
      onClick={(e) => {
        if (!open) {
          onOpen();
          return;
        }
        if (!isWorkspaceRailInteractiveTarget(e.target)) {
          onClose();
        }
      }}
    >
      <div className="workspace-shell__right-drawer-chrome">
        <WorkspaceSidebarDockToggle
          side="right"
          collapsed={!open}
          onToggle={() => (open ? onClose() : onOpen())}
        />
      </div>
      <div className="workspace-shell__right-drawer-body" aria-hidden={!open}>
        <WorkspaceScrollArea className="workspace-shell__pane-scroll" fixedThumbPx={52}>
          {children}
        </WorkspaceScrollArea>
      </div>
    </aside>
  );
}
