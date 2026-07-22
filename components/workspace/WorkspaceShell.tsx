"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

import { WorkspaceArchiveReportPanel } from "@/components/workspace/WorkspaceArchiveReportPanel";
import { WorkspaceLegalDrawer } from "@/components/workspace/WorkspaceLegalDrawer";
import { WorkspaceMobileDrawer } from "@/components/workspace/WorkspaceMobileDrawer";
import { WorkspaceRightDrawer } from "@/components/workspace/WorkspaceRightDrawer";
import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";
import { WorkspaceSidebar, WorkspaceSidebarBrand } from "@/components/workspace/WorkspaceSidebar";
import { isWorkspaceRailInteractiveTarget } from "@/components/workspace/workspace-rail-click";
import { AtmosPanel } from "@/components/workspace/panels/AtmosPanel";
import {
  GlyphPanel,
  MatchPanel,
  PojuPanel,
  SyncroPanel,
} from "@/components/workspace/panels/EnginePanels";
import { ProfilePanel } from "@/components/workspace/panels/ProfilePanel";
import { type WorkspaceProductId } from "@/components/workspace/use-workspace-product-history";
import { markWorkspaceEntered, type WorkspaceTab } from "@/lib/ui-shell/resolve-ui-shell";

type Props = {
  initialTab: WorkspaceTab;
};

function isEngineProduct(tab: WorkspaceTab): tab is WorkspaceProductId {
  return tab === "poju" || tab === "match" || tab === "syncro" || tab === "glyph";
}

function RightDrawerContext({
  tab: _tab,
  archiveId: _archiveId,
  onOpenArchive: _onOpenArchive,
}: {
  tab: WorkspaceTab;
  archiveId: string | null;
  onOpenArchive: (product: WorkspaceProductId, id: string) => void;
}) {
  /* Content cleared — rebuild later */
  return <div className="workspace-right-drawer-placeholder" aria-hidden />;
}

export function WorkspaceShell({ initialTab }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("workspace");
  const archiveFromUrl = searchParams.get("archive");

  const normalizedInitial =
    initialTab === "archive" ? ("poju" as WorkspaceTab) : initialTab;

  const [tab, setTab] = useState<WorkspaceTab>(normalizedInitial);
  const [archiveId, setArchiveId] = useState<string | null>(
    archiveFromUrl && isEngineProduct(normalizedInitial) ? archiveFromUrl : null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem("poju.workspaceSidebarCollapsed") === "1");
    } catch {
      /* private mode */
    }
  }, []);

  // POJU page: right rail always starts collapsed (side copy visible).
  // Other tabs: restore the user's last drawer preference.
  useEffect(() => {
    if (tab === "poju") {
      setRightOpen(false);
      return;
    }
    try {
      setRightOpen(window.localStorage.getItem("poju.workspaceRightDrawerOpen") === "1");
    } catch {
      /* private mode */
    }
  }, [tab]);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("poju.workspaceSidebarCollapsed", next ? "1" : "0");
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  const openRight = useCallback(() => {
    setRightOpen(true);
    try {
      window.localStorage.setItem("poju.workspaceRightDrawerOpen", "1");
    } catch {
      /* private mode */
    }
  }, []);

  const closeRight = useCallback(() => {
    setRightOpen(false);
    try {
      window.localStorage.setItem("poju.workspaceRightDrawerOpen", "0");
    } catch {
      /* private mode */
    }
  }, []);

  const expandLeftSidebar = useCallback(() => {
    setSidebarCollapsed(false);
    try {
      window.localStorage.setItem("poju.workspaceSidebarCollapsed", "0");
    } catch {
      /* private mode */
    }
  }, []);

  const collapseLeftSidebar = useCallback(() => {
    setSidebarCollapsed(true);
    try {
      window.localStorage.setItem("poju.workspaceSidebarCollapsed", "1");
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    const next = initialTab === "archive" ? "poju" : initialTab;
    setTab(next);
    const a = searchParams.get("archive");
    setArchiveId(a && isEngineProduct(next) ? a : null);
  }, [initialTab, searchParams]);

  useEffect(() => {
    markWorkspaceEntered();
  }, []);

  const syncUrl = useCallback(
    (nextTab: WorkspaceTab, nextArchive: string | null) => {
      const q = new URLSearchParams();
      q.set("tab", nextTab);
      if (nextArchive) q.set("archive", nextArchive);
      router.replace(`/app?${q.toString()}`);
    },
    [router],
  );

  const selectNew = useCallback(
    (next: WorkspaceTab) => {
      setTab(next);
      setArchiveId(null);
      syncUrl(next, null);
    },
    [syncUrl],
  );

  const selectArchive = useCallback(
    (product: WorkspaceProductId, id: string) => {
      setTab(product);
      setArchiveId(id);
      syncUrl(product, id);
    },
    [syncUrl],
  );

  function renderCanvas() {
    if (archiveId && isEngineProduct(tab)) {
      return (
        <WorkspaceArchiveReportPanel
          archiveId={archiveId}
          onBack={() => selectNew(tab)}
        />
      );
    }
    switch (tab) {
      case "atmos":
        return <AtmosPanel />;
      case "poju":
        return <PojuPanel onOpenArchive={(id) => selectArchive("poju", id)} />;
      case "match":
        return <MatchPanel onOpenArchive={(id) => selectArchive("match", id)} />;
      case "syncro":
        return <SyncroPanel onOpenArchive={(id) => selectArchive("syncro", id)} />;
      case "glyph":
        return <GlyphPanel onOpenArchive={(id) => selectArchive("glyph", id)} />;
      case "profile":
        return <ProfilePanel />;
      default:
        return <AtmosPanel />;
    }
  }

  return (
    <div
      className={`workspace-shell${sidebarCollapsed ? " is-sidebar-collapsed" : ""}${
        rightOpen ? " is-right-open" : ""
      }`}
    >
      <div className="workspace-shell__sky" aria-hidden />

      <div className="workspace-shell__main">
        <div className="workspace-shell__main-tools">
          <button
            type="button"
            className="workspace-mobile-menu-fab"
            aria-label={t("menuOpen")}
            aria-expanded={menuOpen}
            aria-controls="workspace-mobile-drawer"
            onClick={() => setMenuOpen(true)}
          >
            <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
              menu
            </span>
          </button>
        </div>
        <div className="workspace-shell__canvas workspace-shell__canvas--dense">
          <WorkspaceScrollArea
            className="workspace-shell__pane-scroll"
            viewportClassName="workspace-shell__canvas-viewport"
            fixedThumbPx={52}
          >
            {renderCanvas()}
          </WorkspaceScrollArea>
        </div>
      </div>

      <aside
        className="workspace-shell__sidebar-desktop"
        aria-label="Workspace sidebar"
        onClick={(e) => {
          if (sidebarCollapsed) {
            expandLeftSidebar();
            return;
          }
          if (!isWorkspaceRailInteractiveTarget(e.target)) {
            collapseLeftSidebar();
          }
        }}
      >
        <div className="workspace-shell__left-chrome">
          <WorkspaceSidebarBrand
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapsed}
          />
        </div>
        <WorkspaceScrollArea
          className="workspace-shell__pane-scroll workspace-shell__sidebar-scroll"
          fixedThumbPx={52}
        >
          <WorkspaceSidebar
            activeTab={tab}
            activeArchiveId={archiveId}
            onSelectNew={selectNew}
            onSelectArchive={selectArchive}
            onOpenLegal={() => setLegalOpen(true)}
            onSelectProfile={() => selectNew("profile")}
            collapsed={sidebarCollapsed}
            showBrand={false}
          />
        </WorkspaceScrollArea>
      </aside>

      <WorkspaceRightDrawer open={rightOpen} onOpen={openRight} onClose={closeRight}>
        <RightDrawerContext
          tab={tab}
          archiveId={archiveId}
          onOpenArchive={selectArchive}
        />
      </WorkspaceRightDrawer>

      <WorkspaceMobileDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeTab={tab}
        activeArchiveId={archiveId}
        onSelectNew={selectNew}
        onSelectArchive={selectArchive}
        onOpenLegal={() => setLegalOpen(true)}
        onSelectProfile={() => selectNew("profile")}
      />

      <WorkspaceLegalDrawer open={legalOpen} onClose={() => setLegalOpen(false)} />
    </div>
  );
}
