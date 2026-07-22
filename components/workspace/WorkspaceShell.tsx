"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";

import { WorkspaceLegalDrawer } from "@/components/workspace/WorkspaceLegalDrawer";
import { WorkspaceMobileDrawer } from "@/components/workspace/WorkspaceMobileDrawer";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { WorkspaceTopBar } from "@/components/workspace/WorkspaceTopBar";
import { ArchivePanel } from "@/components/workspace/panels/ArchivePanel";
import { AtmosPanel } from "@/components/workspace/panels/AtmosPanel";
import {
  GlyphPanel,
  MatchPanel,
  PojuPanel,
  SyncroPanel,
} from "@/components/workspace/panels/EnginePanels";
import { ProfilePanel } from "@/components/workspace/panels/ProfilePanel";
import {
  markWorkspaceEntered,
  WORKSPACE_TAB_LABELS,
  type WorkspaceTab,
} from "@/lib/ui-shell/resolve-ui-shell";

type Props = {
  initialTab: WorkspaceTab;
};

function renderPanel(tab: WorkspaceTab) {
  switch (tab) {
    case "atmos":
      return <AtmosPanel />;
    case "poju":
      return <PojuPanel />;
    case "match":
      return <MatchPanel />;
    case "syncro":
      return <SyncroPanel />;
    case "glyph":
      return <GlyphPanel />;
    case "archive":
      return <ArchivePanel />;
    case "profile":
      return <ProfilePanel />;
    default:
      return <AtmosPanel />;
  }
}

export function WorkspaceShell({ initialTab }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    markWorkspaceEntered();
  }, []);

  const selectTab = useCallback(
    (next: WorkspaceTab) => {
      setTab(next);
      router.replace(`/app?tab=${next}`);
    },
    [router],
  );

  return (
    <div className="workspace-shell">
      <aside className="workspace-shell__sidebar-desktop" aria-label="Workspace sidebar">
        <WorkspaceSidebar
          activeTab={tab}
          onSelect={selectTab}
          onOpenLegal={() => setLegalOpen(true)}
        />
      </aside>

      <div className="workspace-shell__main">
        <WorkspaceTopBar
          engineTitle={WORKSPACE_TAB_LABELS[tab]}
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((o) => !o)}
        />
        <main className="workspace-shell__canvas">{renderPanel(tab)}</main>
      </div>

      <WorkspaceMobileDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeTab={tab}
        onSelect={selectTab}
        onOpenLegal={() => setLegalOpen(true)}
      />

      <WorkspaceLegalDrawer open={legalOpen} onClose={() => setLegalOpen(false)} />
    </div>
  );
}
