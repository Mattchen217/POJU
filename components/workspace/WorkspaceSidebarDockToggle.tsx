"use client";

import { useTranslations } from "next-intl";

import {
  SidebarDockCollapseIcon,
  SidebarDockExpandIcon,
  SidebarDockIdleIcon,
} from "@/components/workspace/workspace-sidebar-dock-icons";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  /** left = main nav rail; right = context drawer (icons mirrored) */
  side?: "left" | "right";
};

/** Desktop sidebar rail toggle — idle panel icon; hover shows chevron + tip. */
export function WorkspaceSidebarDockToggle({
  collapsed,
  onToggle,
  side = "left",
}: Props) {
  const t = useTranslations("workspace.density");
  const tip =
    side === "right"
      ? collapsed
        ? t("expandRightSidebar")
        : t("collapseRightSidebar")
      : collapsed
        ? t("expandSidebar")
        : t("collapseSidebar");

  return (
    <button
      type="button"
      className={`workspace-sidebar-dock-toggle${collapsed ? " is-collapsed" : ""}${
        side === "right" ? " workspace-sidebar-dock-toggle--right" : ""
      }`}
      aria-label={tip}
      aria-expanded={!collapsed}
      data-tooltip={tip}
      data-workspace-right-dock={side === "right" ? "true" : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <span className="workspace-sidebar-dock-toggle__icon workspace-sidebar-dock-toggle__icon--idle">
        <SidebarDockIdleIcon />
      </span>
      <span className="workspace-sidebar-dock-toggle__icon workspace-sidebar-dock-toggle__icon--hover">
        {collapsed ? <SidebarDockExpandIcon /> : <SidebarDockCollapseIcon />}
      </span>
    </button>
  );
}
