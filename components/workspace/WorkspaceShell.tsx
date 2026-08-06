"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

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
import { WorkspaceRightDocVault } from "@/components/workspace/WorkspaceRightDocVault";
import {
  WorkspaceDocVaultProvider,
  useWorkspaceDocVaultOptional,
} from "@/components/workspace/WorkspaceDocVaultContext";
import { WorkspaceGlyphRightPanel } from "@/components/workspace/WorkspaceGlyphRightPanel";
import { WorkspaceAtmosRightPanel } from "@/components/workspace/WorkspaceAtmosRightPanel";
import type { DocVaultItem } from "@/lib/workspace/doc-vault-types";
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
import { markWorkspaceEntered, parseWorkspaceTab, type WorkspaceTab } from "@/lib/ui-shell/resolve-ui-shell";
import {
  clearLastPojuWorkspaceSessionId,
  readLastPojuWorkspaceSessionId,
  writeLastPojuWorkspaceSessionId,
} from "@/lib/poju/workspace-last-session";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";
import { subscribeLocalOwnerKey } from "@/lib/storage/local-owner";

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
  // Cross-product document vault is the persistent right-rail content.
  // Match/Atmos/Glyph live generate UIs remain available when those tabs need them.
  if (tab === "match") {
    return (
      <>
        <WorkspaceMatchRightPanel />
        <WorkspaceRightDocVault />
      </>
    );
  }
  if (tab === "atmos") {
    return (
      <>
        <WorkspaceAtmosRightPanel />
        <WorkspaceRightDocVault />
      </>
    );
  }
  if (tab === "glyph") {
    return (
      <>
        <WorkspaceGlyphRightPanel />
        <WorkspaceRightDocVault />
      </>
    );
  }
  return <WorkspaceRightDocVault />;
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

/** Wire doc-vault card clicks → tab switch + open artifact. */
function DocVaultOpenBinder({
  selectArchive,
  setTab,
  openRight,
}: {
  selectArchive: (product: WorkspaceProductId, id: string) => void;
  setTab: (tab: WorkspaceTab) => void;
  openRight: () => void;
}) {
  const locale = useLocale();
  const vault = useWorkspaceDocVaultOptional();
  const prepare = useWorkspacePojuPrepareOptional();
  const resumeRef = useRef(prepare?.resumeSession);
  const openProfileRef = useRef(prepare?.openProfileArtifact);
  const openShelfRef = useRef(prepare?.requestOpenDeliveryShelf);
  resumeRef.current = prepare?.resumeSession;
  openProfileRef.current = prepare?.openProfileArtifact;
  openShelfRef.current = prepare?.requestOpenDeliveryShelf;

  useEffect(() => {
    if (!vault) return;
    vault.setOpenHandlers({
      openItem: async (item: DocVaultItem) => {
        const target = item.openTarget;
        if (target.type === "profile_matrix") {
          setTab("poju");
          openRight();
          await openProfileRef.current?.(target.profileId, locale, "matrix");
          return;
        }
        if (target.type === "profile_report") {
          setTab("poju");
          openRight();
          await openProfileRef.current?.(target.profileId, locale, "report");
          return;
        }
        if (target.type === "pivot_delivery") {
          selectArchive("poju", target.sessionId);
          openRight();
          const ok = await resumeRef.current?.(target.sessionId, locale);
          if (ok) {
            openShelfRef.current?.();
          }
          return;
        }
        if (target.type === "archive") {
          selectArchive(target.product, target.archiveId);
          openRight();
        }
      },
    });
    return () => vault.setOpenHandlers(null);
  }, [vault, locale, selectArchive, setTab, openRight]);

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

/** Live `/app` query — prefer window so we don't fight stale useSearchParams after replaceState. */
function readAppQueryFromWindow(): {
  tab: string | null;
  archive: string | null;
  session: string | null;
} {
  if (typeof window === "undefined") {
    return { tab: null, archive: null, session: null };
  }
  const q = new URLSearchParams(window.location.search);
  return {
    tab: q.get("tab"),
    archive: q.get("archive"),
    session: q.get("session"),
  };
}

/** True while the browser URL is still the workspace shell (`/app` or `/{locale}/app`). */
function isWorkspaceAppPathname(pathname = typeof window !== "undefined" ? window.location.pathname : ""): boolean {
  return pathname === "/app" || /^\/(zh|es|de|fr)\/app\/?$/.test(pathname);
}

function buildAppQueryString(
  nextTab: WorkspaceTab,
  nextArchive: string | null,
  nextSession: string | null,
): string {
  const q = new URLSearchParams();
  q.set("tab", nextTab);
  if (nextTab === "poju") {
    if (nextSession) q.set("session", nextSession);
  } else if (nextArchive) {
    q.set("archive", nextArchive);
  }
  return q.toString();
}

/**
 * Workspace stay / refresh / record rules (Pivot):
 *
 * - Stay on a product tab: in-memory prepare state is kept (tab switch does not reset).
 * - Refresh on `/app?tab=poju&session=`: hydrate resumes that session from IndexedDB.
 * - Refresh on `/app?tab=atmos` (etc.): stay on that product — URL must follow tab switches.
 * - "New" clears last-session storage and resets prepare → entry screen.
 * - Logo / leave `/app`: must NOT call syncUrl — in-flight resume used to
 *   rewrite `/app?…` and yank users off the landing page.
 *
 * All `/app` query writes use history.replaceState (not next-intl router.replace):
 * same-pathname query-only replaces often no-op'd, leaving `tab=poju&session=` stuck
 * while the canvas already showed Atmos/Match/….
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
  const syncRef = useRef(syncPojuSessionUrl);
  syncRef.current = syncPojuSessionUrl;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const phase = prepare?.phase;
  const sessionId = prepare?.session?.session_id?.trim() || null;
  const resumeSession = prepare?.resumeSession;

  // Persist last session id (storage always; URL only while still on /app + POJU tab).
  useEffect(() => {
    if (phase !== "chat" || !sessionId) return;
    writeLastPojuWorkspaceSessionId(sessionId);
    if (tab !== "poju") return;
    if (!isWorkspaceAppPathname()) return;
    const urlSession = readAppQueryFromWindow().session;
    if (lastSyncedSessionRef.current === sessionId && urlSession === sessionId) return;
    lastSyncedSessionRef.current = sessionId;
    syncRef.current(sessionId);
  }, [phase, sessionId, tab]);

  // One-shot hydrate when user is on POJU and idle (refresh / cold enter).
  useEffect(() => {
    if (!resumeSession || tab !== "poju") return;
    if (phase !== "idle") return;
    if (!isWorkspaceAppPathname()) return;

    const urlSession = readAppQueryFromWindow().session?.trim() || sessionFromUrl?.trim() || null;
    // Only resume when URL already has session= — do not yank to last delivery
    // on locale remount / prepare screen without an explicit session in the URL.
    const target = urlSession || null;
    if (!target) return;

    const key = `idle:${target}`;
    if (hydrateKeyRef.current === key) return;
    hydrateKeyRef.current = key;

    void resumeSession(target, locale).then((ok) => {
      // Left workspace (logo → landing) or left POJU tab — never yank URL back.
      if (!mountedRef.current) return;
      if (tabRef.current !== "poju") return;
      if (!isWorkspaceAppPathname()) return;
      if (!ok) {
        clearLastPojuWorkspaceSessionId();
        hydrateKeyRef.current = null;
        if (readAppQueryFromWindow().session) syncRef.current(null);
        return;
      }
      writeLastPojuWorkspaceSessionId(target);
      lastSyncedSessionRef.current = target;
      if (readAppQueryFromWindow().session !== target) syncRef.current(target);
    });
  }, [tab, phase, sessionFromUrl, locale, resumeSession]);

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
  /** Live product tab — prefer over lagging useSearchParams after replaceState. */
  const tabRef = useRef(tab);
  tabRef.current = tab;

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

  /** Apply tab/archive from the *live* browser URL (replaceState does not update useSearchParams). */
  const applyTabFromLiveUrl = useCallback(() => {
    const live = readAppQueryFromWindow();
    const parsed = parseWorkspaceTab(live.tab);
    const next = parsed === "archive" ? ("poju" as WorkspaceTab) : parsed;
    setTab(next);
    setArchiveId(
      live.archive && isEngineProduct(next) && next !== "poju" ? live.archive : null,
    );
  }, []);

  useEffect(() => {
    applyTabFromLiveUrl();
  }, [initialTab, searchParams, applyTabFromLiveUrl]);

  useEffect(() => {
    const onPopState = () => applyTabFromLiveUrl();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyTabFromLiveUrl]);

  useEffect(() => {
    markWorkspaceEntered();
  }, []);

  const syncUrl = useCallback(
    (nextTab: WorkspaceTab, nextArchive: string | null, nextSession: string | null = null) => {
      // Never rewrite URL after user left `/app` (e.g. logo → landing).
      if (typeof window !== "undefined" && !isWorkspaceAppPathname()) return;

      const nextQs = buildAppQueryString(nextTab, nextArchive, nextSession);
      const cur = readAppQueryFromWindow();
      const same =
        cur.tab === nextTab &&
        (nextTab === "poju"
          ? (cur.session ?? null) === (nextSession ?? null)
          : (cur.archive ?? null) === (nextArchive ?? null) && !cur.session);
      if (same) return;

      // Always write via replaceState while on `/app`.
      // next-intl `router.replace('/app?…')` often no-ops when pathname stays `/app`
      // and only `?tab=` / `?session=` change — so the UI moved to Atmos but the
      // address bar stayed on `tab=poju&session=…`, and refresh restored Pivot chat.
      const path = window.location.pathname;
      const href = nextQs ? `${path}?${nextQs}` : path;
      window.history.replaceState(window.history.state, "", href);
    },
    [],
  );

  /** Account switch: refresh product lists; leave foreign open Pivot session. */
  useEffect(() => {
    return subscribeLocalOwnerKey(() => {
      void (async () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(ARCHIVE_UPDATED_EVENT));
        }

        const openId =
          readAppQueryFromWindow().session?.trim() || readLastPojuWorkspaceSessionId();
        if (!openId) return;

        const { getPOJUSessionRecord } = await import("@/lib/poju/session-manager");
        const row = await getPOJUSessionRecord(openId);
        if (row) return;

        clearLastPojuWorkspaceSessionId();
        try {
          sessionStorage.removeItem("syncro_last_session_id");
        } catch {
          /* private mode */
        }
        pojuPrepareResetRef.current?.();
        setArchiveId(null);
        const liveTab = readAppQueryFromWindow().tab;
        if (liveTab === "poju" || liveTab === "archive" || liveTab == null) {
          syncUrl("poju", null, null);
        }
      })();
    });
  }, [syncUrl]);

  const syncPojuSessionUrl = useCallback(
    (sessionId: string | null) => {
      // Never yank the user back onto POJU from another product tab (React or URL).
      if (tabRef.current !== "poju") return;
      const liveTab = readAppQueryFromWindow().tab;
      if (liveTab != null && liveTab !== "poju" && liveTab !== "archive") return;
      syncUrl("poju", null, sessionId);
    },
    [syncUrl],
  );

  /** Switch product tab — keep in-progress flow (no reset). */
  const selectTab = useCallback(
    (next: WorkspaceTab) => {
      // Write URL first (sync replaceState) so refresh/language never see a stale Pivot session.
      if (next === "poju") {
        const last = readLastPojuWorkspaceSessionId();
        syncUrl("poju", null, last);
      } else {
        syncUrl(next, null, null);
      }
      setTab(next);
      setArchiveId(null);
    },
    [syncUrl],
  );

  /** Explicit New — reset that product to its entry state. */
  const selectNew = useCallback(
    (next: WorkspaceTab) => {
      if (next === "poju") {
        clearLastPojuWorkspaceSessionId();
        syncUrl("poju", null, null);
        pojuPrepareResetRef.current?.();
      } else {
        syncUrl(next, null, null);
      }
      setTab(next);
      setArchiveId(null);
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
        writeLastPojuWorkspaceSessionId(id);
        syncUrl("poju", null, id);
        setTab("poju");
        setArchiveId(null);
        void pojuResumeSessionRef.current?.(id);
        return;
      }
      syncUrl(product, id, null);
      setTab(product);
      setArchiveId(id);
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
      <WorkspaceDocVaultProvider>
      <WorkspacePojuPrepareProvider openRight={openRight}>
        <WorkspaceAtmosPrepareProvider openRight={openRight}>
        <WorkspaceMatchPrepareProvider openRight={openRight}>
        <WorkspaceGlyphPrepareProvider openRight={openRight}>
        <DocVaultOpenBinder
          selectArchive={selectArchive}
          setTab={setTab}
          openRight={openRight}
        />
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
            // Links (logo → landing) / buttons must not be swallowed by rail toggle.
            if (isWorkspaceRailInteractiveTarget(e.target)) return;
            if (sidebarCollapsed) {
              expandLeftSidebar();
              return;
            }
            collapseLeftSidebar();
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
      </WorkspaceDocVaultProvider>
    </AppDialogProvider>
  );
}
