"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

import { AppDialogProvider } from "@/components/ui/app-dialog";
import { WorkspaceArchiveReportPanel } from "@/components/workspace/WorkspaceArchiveReportPanel";
import { WorkspaceMobileDrawer } from "@/components/workspace/WorkspaceMobileDrawer";
import {
  WorkspacePojuPrepareProvider,
  useWorkspacePojuPrepareOptional,
  useWorkspaceRightRailWide,
} from "@/components/workspace/WorkspacePojuPrepareContext";
import {
  WorkspaceAtmosPrepareProvider,
  useWorkspaceAtmosPrepareOptional,
  useWorkspaceAtmosRightRailWide,
} from "@/components/workspace/WorkspaceAtmosPrepareContext";
import {
  WorkspaceGlyphPrepareProvider,
  useWorkspaceGlyphPrepareOptional,
  useWorkspaceGlyphRightRailWide,
} from "@/components/workspace/WorkspaceGlyphPrepareContext";
import {
  WorkspaceMatchPrepareProvider,
  useWorkspaceMatchPrepareOptional,
  useWorkspaceMatchRightRailWide,
} from "@/components/workspace/WorkspaceMatchPrepareContext";
import { WorkspaceMatchRightPanel } from "@/components/workspace/WorkspaceMatchRightPanel";
import { WorkspaceRightDrawer } from "@/components/workspace/WorkspaceRightDrawer";
import { WorkspaceRightMatrixPanel } from "@/components/workspace/WorkspaceRightMatrixPanel";
import { WorkspaceGlyphRightPanel } from "@/components/workspace/WorkspaceGlyphRightPanel";
import { WorkspaceAtmosRightPanel } from "@/components/workspace/WorkspaceAtmosRightPanel";
import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";
import { WorkspaceSidebar, WorkspaceSidebarBrand } from "@/components/workspace/WorkspaceSidebar";
import { WorkspaceStarfieldLayer } from "@/components/workspace/WorkspaceStarfieldLayer";
import { isWorkspaceRailInteractiveTarget } from "@/components/workspace/workspace-rail-click";
import { AtmosPanel } from "@/components/workspace/panels/AtmosPanel";
import { GlyphPanel } from "@/components/workspace/panels/GlyphPanel";
import { SyncroPanel } from "@/components/workspace/panels/SyncroPanel";
import {
  MatchPanel,
  PojuPanel,
} from "@/components/workspace/panels/EnginePanels";
import { ProfilePanel } from "@/components/workspace/panels/ProfilePanel";
import { type WorkspaceProductId } from "@/components/workspace/use-workspace-product-history";
import { markWorkspaceEntered, type WorkspaceTab } from "@/lib/ui-shell/resolve-ui-shell";
import {
  clearLastPojuWorkspaceSessionId,
  readLastPojuWorkspaceSessionId,
  writeLastPojuWorkspaceSessionId,
} from "@/lib/poju/workspace-last-session";

type Props = {
  initialTab: WorkspaceTab;
};

function isEngineProduct(tab: WorkspaceTab): tab is WorkspaceProductId {
  return (
    tab === "atmos" ||
    tab === "poju" ||
    tab === "match" ||
    tab === "syncro" ||
    tab === "glyph"
  );
}

function RightDrawerContext({
  tab,
  archiveId: _archiveId,
  onOpenArchive: _onOpenArchive,
}: {
  tab: WorkspaceTab;
  archiveId: string | null;
  onOpenArchive: (product: WorkspaceProductId, id: string) => void;
}) {
  if (tab === "poju") {
    return <WorkspaceRightMatrixPanel />;
  }
  if (tab === "atmos") {
    return <WorkspaceAtmosRightPanel />;
  }
  if (tab === "match") {
    return <WorkspaceMatchRightPanel />;
  }
  if (tab === "glyph") {
    return <WorkspaceGlyphRightPanel />;
  }
  return <div className="workspace-right-drawer-placeholder" aria-hidden />;
}

/** Keeps POJU right rail closed only while birth entry is idle. Never resets on tab leave. */
function PojuRightRailGate({
  tab,
  setRightOpen,
}: {
  tab: WorkspaceTab;
  setRightOpen: (open: boolean) => void;
}) {
  const prepare = useWorkspacePojuPrepareOptional();
  const phase = prepare?.phase ?? "idle";

  useEffect(() => {
    if (tab !== "poju") {
      if (tab !== "match" && tab !== "atmos" && tab !== "glyph") {
        try {
          setRightOpen(window.localStorage.getItem("poju.workspaceRightDrawerOpen") === "1");
        } catch {
          /* private mode */
        }
      }
      return;
    }
    if (phase === "idle" || phase === "handoff") {
      setRightOpen(false);
    }
  }, [tab, phase, setRightOpen]);

  return null;
}

/** Opens Match right rail after warmup matrices are ready. Never resets on tab leave. */
function MatchRightRailGate({
  tab,
  setRightOpen,
}: {
  tab: WorkspaceTab;
  setRightOpen: (open: boolean) => void;
}) {
  const match = useWorkspaceMatchPrepareOptional();
  const phase = match?.phase ?? "entry";
  const hasMatrices = Boolean(match?.matrixPayloadA || match?.matrixPayloadB);

  useEffect(() => {
    if (tab !== "match") return;
    if (phase === "entry" || phase === "warmup" || !hasMatrices) {
      setRightOpen(false);
      return;
    }
    setRightOpen(true);
  }, [tab, phase, hasMatrices, setRightOpen]);

  return null;
}

/** Keeps Glyph right rail closed while birth entry is idle. */
function GlyphRightRailGate({
  tab,
  setRightOpen,
}: {
  tab: WorkspaceTab;
  setRightOpen: (open: boolean) => void;
}) {
  const prepare = useWorkspaceGlyphPrepareOptional();
  const phase = prepare?.phase ?? "idle";

  useEffect(() => {
    if (tab !== "glyph") return;
    if (phase === "idle" || phase === "handoff") {
      setRightOpen(false);
    }
  }, [tab, phase, setRightOpen]);

  return null;
}

function AtmosRightRailGate({
  tab,
  setRightOpen,
}: {
  tab: WorkspaceTab;
  setRightOpen: (open: boolean) => void;
}) {
  const prepare = useWorkspaceAtmosPrepareOptional();
  const phase = prepare?.phase ?? "idle";

  useEffect(() => {
    if (tab !== "atmos") return;
    if (phase === "idle" || phase === "handoff") {
      setRightOpen(false);
    }
  }, [tab, phase, setRightOpen]);

  return null;
}

/** Applies right-rail wide class from prepare state (must sit under PrepareProvider). */
function WorkspaceShellSurface({
  sidebarCollapsed,
  rightOpen,
  children,
}: {
  sidebarCollapsed: boolean;
  rightOpen: boolean;
  children: ReactNode;
}) {
  const pojuWide = useWorkspaceRightRailWide();
  const matchWide = useWorkspaceMatchRightRailWide();
  const atmosWide = useWorkspaceAtmosRightRailWide();
  const glyphWide = useWorkspaceGlyphRightRailWide();
  const rightWide = pojuWide || matchWide || atmosWide || glyphWide;
  return (
    <div
      className={`workspace-shell${sidebarCollapsed ? " is-sidebar-collapsed" : ""}${
        rightOpen ? " is-right-open" : ""
      }${rightOpen && rightWide ? " is-right-wide" : ""}`}
    >
      {children}
    </div>
  );
}

function WorkspaceRightDrawerHost({
  rightOpen,
  onOpen,
  onClose,
  tab,
  archiveId,
  onOpenArchive,
}: {
  rightOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  tab: WorkspaceTab;
  archiveId: string | null;
  onOpenArchive: (product: WorkspaceProductId, id: string) => void;
}) {
  const pojuWide = useWorkspaceRightRailWide();
  const matchWide = useWorkspaceMatchRightRailWide();
  const atmosWide = useWorkspaceAtmosRightRailWide();
  const glyphWide = useWorkspaceGlyphRightRailWide();
  const rightWide = pojuWide || matchWide || atmosWide || glyphWide;
  return (
    <WorkspaceRightDrawer open={rightOpen} wide={rightWide} onOpen={onOpen} onClose={onClose}>
      <RightDrawerContext tab={tab} archiveId={archiveId} onOpenArchive={onOpenArchive} />
    </WorkspaceRightDrawer>
  );
}

/** Bind prepare.resetPrepare / resumeSession for shell actions outside the hook tree. */
function PojuPrepareResetBinder({
  resetRef,
  resumeRef,
}: {
  resetRef: { current: (() => void) | null };
  resumeRef: { current: ((sessionId: string) => Promise<boolean>) | null };
}) {
  const prepare = useWorkspacePojuPrepareOptional();
  const locale = useLocale();
  useEffect(() => {
    resetRef.current = prepare?.resetPrepare ?? null;
    resumeRef.current = prepare
      ? (sessionId: string) => prepare.resumeSession(sessionId, locale)
      : null;
    return () => {
      resetRef.current = null;
      resumeRef.current = null;
    };
  }, [prepare, prepare?.resetPrepare, prepare?.resumeSession, locale, resetRef, resumeRef]);
  return null;
}

/**
 * Keep active POJU chat in `?session=` + localStorage so refresh restores the conversation.
 * Deliberately conservative: never fight the user when they leave the POJU tab,
 * and never rewrite the URL on every chat message.
 */
function PojuSessionPersistence({
  tab,
  sessionFromUrl,
  syncPojuSessionUrl,
}: {
  tab: WorkspaceTab;
  sessionFromUrl: string | null;
  syncPojuSessionUrl: (sessionId: string | null) => void;
}) {
  const prepare = useWorkspacePojuPrepareOptional();
  const locale = useLocale();
  const lastSyncedSessionRef = useRef<string | null>(null);
  const hydrateKeyRef = useRef<string | null>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const phase = prepare?.phase;
  const sessionId = prepare?.session?.session_id?.trim() || null;
  const resumeSession = prepare?.resumeSession;

  // Persist last session id (storage always; URL only while on POJU tab).
  useEffect(() => {
    if (phase !== "chat" || !sessionId) return;
    writeLastPojuWorkspaceSessionId(sessionId);
    if (tab !== "poju") return;
    if (lastSyncedSessionRef.current === sessionId && sessionFromUrl === sessionId) return;
    lastSyncedSessionRef.current = sessionId;
    syncPojuSessionUrl(sessionId);
  }, [phase, sessionId, tab, sessionFromUrl, syncPojuSessionUrl]);

  // One-shot hydrate when user is on POJU and idle (refresh / cold enter).
  useEffect(() => {
    if (!resumeSession || tab !== "poju") return;
    if (phase !== "idle") return;

    const target = sessionFromUrl?.trim() || readLastPojuWorkspaceSessionId() || null;
    if (!target) return;

    const key = `idle:${target}`;
    if (hydrateKeyRef.current === key) return;
    hydrateKeyRef.current = key;

    void resumeSession(target, locale).then((ok) => {
      // User may have left POJU while resume was in flight — do not yank URL back.
      if (tabRef.current !== "poju") return;
      if (!ok) {
        clearLastPojuWorkspaceSessionId();
        hydrateKeyRef.current = null;
        if (sessionFromUrl) syncPojuSessionUrl(null);
        return;
      }
      writeLastPojuWorkspaceSessionId(target);
      lastSyncedSessionRef.current = target;
      if (sessionFromUrl !== target) syncPojuSessionUrl(target);
    });
  }, [tab, phase, sessionFromUrl, locale, resumeSession, syncPojuSessionUrl]);

  // Leaving POJU: allow a fresh hydrate next time we land idle on POJU.
  useEffect(() => {
    if (tab !== "poju") {
      hydrateKeyRef.current = null;
    }
  }, [tab]);

  return null;
}

function MatchPrepareResetBinder({
  resetRef,
}: {
  resetRef: { current: (() => void) | null };
}) {
  const match = useWorkspaceMatchPrepareOptional();
  useEffect(() => {
    resetRef.current = match?.resetMatch ?? null;
    return () => {
      resetRef.current = null;
    };
  }, [match, match?.resetMatch, resetRef]);
  return null;
}

function AtmosPrepareResetBinder({
  resetRef,
}: {
  resetRef: { current: (() => void) | null };
}) {
  const prepare = useWorkspaceAtmosPrepareOptional();
  useEffect(() => {
    resetRef.current = prepare?.resetPrepare ?? null;
    return () => {
      resetRef.current = null;
    };
  }, [prepare, prepare?.resetPrepare, resetRef]);
  return null;
}

export function WorkspaceShell({ initialTab }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("workspace");
  const archiveFromUrl = searchParams.get("archive");
  const sessionFromUrl = searchParams.get("session");

  const normalizedInitial =
    initialTab === "archive" ? ("poju" as WorkspaceTab) : initialTab;

  const [tab, setTab] = useState<WorkspaceTab>(normalizedInitial);
  const [archiveId, setArchiveId] = useState<string | null>(
    archiveFromUrl &&
      isEngineProduct(normalizedInitial) &&
      normalizedInitial !== "poju"
      ? archiveFromUrl
      : null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const pojuPrepareResetRef = useRef<(() => void) | null>(null);
  const pojuResumeSessionRef = useRef<((sessionId: string) => Promise<boolean>) | null>(null);
  const matchPrepareResetRef = useRef<(() => void) | null>(null);
  const atmosPrepareResetRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem("poju.workspaceSidebarCollapsed") === "1");
    } catch {
      /* private mode */
    }
  }, []);

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
    // POJU live chats use `session=`; `archive=` is for other products' report embeds.
    setArchiveId(a && isEngineProduct(next) && next !== "poju" ? a : null);
  }, [initialTab, searchParams]);

  useEffect(() => {
    markWorkspaceEntered();
  }, []);

  const syncUrl = useCallback(
    (nextTab: WorkspaceTab, nextArchive: string | null, nextSession: string | null = null) => {
      const q = new URLSearchParams();
      q.set("tab", nextTab);
      if (nextTab === "poju") {
        if (nextSession) q.set("session", nextSession);
      } else if (nextArchive) {
        q.set("archive", nextArchive);
      }
      const nextQs = q.toString();
      const curTab = searchParams.get("tab");
      const curArchive = searchParams.get("archive");
      const curSession = searchParams.get("session");
      const same =
        curTab === nextTab &&
        (nextTab === "poju"
          ? (curSession ?? null) === (nextSession ?? null)
          : (curArchive ?? null) === (nextArchive ?? null) && !curSession);
      if (same) return;
      router.replace(`/app?${nextQs}`);
    },
    [router, searchParams],
  );

  const syncPojuSessionUrl = useCallback(
    (sessionId: string | null) => {
      // Never yank the user back onto POJU from another product tab.
      const liveTab = searchParams.get("tab") ?? "poju";
      if (liveTab !== "poju" && liveTab !== "archive") return;
      syncUrl("poju", null, sessionId);
    },
    [syncUrl, searchParams],
  );

  /** Switch product tab — keep in-progress flow (no reset). */
  const selectTab = useCallback(
    (next: WorkspaceTab) => {
      setTab(next);
      setArchiveId(null);
      if (next === "poju") {
        // Restore last chat only via URL; hydrate runs if phase is still idle.
        // If chat is already in memory, persist effect will align `session=`.
        const last = readLastPojuWorkspaceSessionId();
        syncUrl("poju", null, last);
      } else {
        syncUrl(next, null, null);
      }
    },
    [syncUrl],
  );

  /** Explicit New — reset that product to its entry state. */
  const selectNew = useCallback(
    (next: WorkspaceTab) => {
      setTab(next);
      setArchiveId(null);
      if (next === "poju") {
        clearLastPojuWorkspaceSessionId();
        syncUrl("poju", null, null);
        pojuPrepareResetRef.current?.();
      } else {
        syncUrl(next, null, null);
      }
      if (next === "match") {
        matchPrepareResetRef.current?.();
      }
      if (next === "atmos") {
        atmosPrepareResetRef.current?.();
      }
    },
    [syncUrl],
  );

  const selectArchive = useCallback(
    (product: WorkspaceProductId, id: string) => {
      if (product === "poju") {
        setTab("poju");
        setArchiveId(null);
        writeLastPojuWorkspaceSessionId(id);
        syncUrl("poju", null, id);
        void pojuResumeSessionRef.current?.(id);
        return;
      }
      setTab(product);
      setArchiveId(id);
      syncUrl(product, id, null);
    },
    [syncUrl],
  );

  function renderCanvas() {
    // POJU live chat uses `?session=` — never treat as archive report embed.
    if (archiveId && isEngineProduct(tab) && tab !== "poju") {
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
        return <SyncroPanel />;
      case "glyph":
        return <GlyphPanel />;
      case "profile":
        return <ProfilePanel />;
      default:
        return <AtmosPanel />;
    }
  }

  return (
    <AppDialogProvider>
      <WorkspacePojuPrepareProvider openRight={openRight}>
        <WorkspaceAtmosPrepareProvider openRight={openRight}>
        <WorkspaceMatchPrepareProvider openRight={openRight}>
        <WorkspaceGlyphPrepareProvider openRight={openRight}>
        <PojuPrepareResetBinder
          resetRef={pojuPrepareResetRef}
          resumeRef={pojuResumeSessionRef}
        />
        <PojuSessionPersistence
          tab={tab}
          sessionFromUrl={sessionFromUrl}
          syncPojuSessionUrl={syncPojuSessionUrl}
        />
        <MatchPrepareResetBinder resetRef={matchPrepareResetRef} />
        <AtmosPrepareResetBinder resetRef={atmosPrepareResetRef} />
        <PojuRightRailGate tab={tab} setRightOpen={setRightOpen} />
        <AtmosRightRailGate tab={tab} setRightOpen={setRightOpen} />
        <MatchRightRailGate tab={tab} setRightOpen={setRightOpen} />
        <GlyphRightRailGate tab={tab} setRightOpen={setRightOpen} />
        <WorkspaceShellSurface sidebarCollapsed={sidebarCollapsed} rightOpen={rightOpen}>
        <WorkspaceStarfieldLayer />
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
              onSelectTab={selectTab}
              onSelectNew={selectNew}
              onSelectArchive={selectArchive}
              onSelectProfile={() => selectTab("profile")}
              collapsed={sidebarCollapsed}
              showBrand={false}
            />
          </WorkspaceScrollArea>
        </aside>

        <WorkspaceRightDrawerHost
          rightOpen={rightOpen}
          onOpen={openRight}
          onClose={closeRight}
          tab={tab}
          archiveId={archiveId}
          onOpenArchive={selectArchive}
        />

        <WorkspaceMobileDrawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          activeTab={tab}
          activeArchiveId={archiveId}
          onSelectTab={selectTab}
          onSelectNew={selectNew}
          onSelectArchive={selectArchive}
          onSelectProfile={() => selectTab("profile")}
        />
        </WorkspaceShellSurface>
        </WorkspaceGlyphPrepareProvider>
        </WorkspaceMatchPrepareProvider>
        </WorkspaceAtmosPrepareProvider>
      </WorkspacePojuPrepareProvider>
    </AppDialogProvider>
  );
}
