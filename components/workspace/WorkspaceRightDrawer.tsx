"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { WorkspaceRightCollapsedIcons } from "@/components/workspace/WorkspaceRightCollapsedIcons";
import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";
import { WorkspaceSidebarDockToggle } from "@/components/workspace/WorkspaceSidebarDockToggle";
import { isWorkspaceRailInteractiveTarget } from "@/components/workspace/workspace-rail-click";

type Props = {
  open: boolean;
  /** Wide = 3× left sidebar; otherwise open width matches left sidebar. */
  wide?: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Desktop right drawer —
 * collapsed mini-rail; open = left-sidebar width; open+wide = 3× for matrix / wait / report.
 */
export function WorkspaceRightDrawer({
  open,
  wide = false,
  onOpen,
  onClose,
  children,
}: Props) {
  const t = useTranslations("workspace.density");

  return (
    <aside
      className={`workspace-shell__right-drawer${open ? " is-open" : " is-collapsed"}${
        open && wide ? " is-wide" : ""
      }`}
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
      <WorkspaceRightCollapsedIcons visible={!open} onOpenPanel={onOpen} />
      <div className="workspace-shell__right-drawer-body" aria-hidden={!open}>
        <WorkspaceScrollArea className="workspace-shell__pane-scroll" fixedThumbPx={52}>
          {children}
        </WorkspaceScrollArea>
      </div>
    </aside>
  );
}
