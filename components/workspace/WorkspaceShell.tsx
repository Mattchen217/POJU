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
import { WorkspaceRightDrawer } from "@/components/workspace/WorkspaceRightDrawer";
import { WorkspaceRightDocVault } from "@/components/workspace/WorkspaceRightDocVault";
import {
  WorkspaceDocVaultProvider,
  useWorkspaceDocVaultOptional,
} from "@/components/workspace/WorkspaceDocVaultContext";
import { WorkspaceAtmosRightPanel } from "@/components/workspace/WorkspaceAtmosRightPanel";
import { DocVaultIds } from "@/lib/workspace/doc-vault-index";
import { markDocVaultRead } from "@/lib/workspace/doc-vault-unread";
import {
  BASELINE_AUTO_OPEN_EVENT,
  DELIVERY_AUTO_OPEN_EVENT,
  type BaselineAutoOpenDetail,
  type DeliveryAutoOpenDetail,
  type DocVaultItem,
} from "@/lib/workspace/doc-vault-types";
import { WorkspaceDocVaultModal } from "@/components/workspace/WorkspaceDocVaultModal";
import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";
import { WorkspaceSidebar, WorkspaceSidebarBrand } from "@/components/workspace/WorkspaceSidebar";
import { WorkspaceStarfieldGate } from "@/components/workspace/WorkspaceStarfieldLayer";
import { isWorkspaceRailInteractiveTarget } from "@/components/workspace/workspace-rail-click";
import { AtmosPanel } from "@/components/workspace/panels/AtmosPanel";
import { PojuPanel } from "@/components/workspace/panels/EnginePanels";
import { ProfilePanel } from "@/components/workspace/panels/ProfilePanel";
import { type WorkspaceProductId } from "@/components/workspace/use-workspace-product-history";
import { markWorkspaceEntered, parseWorkspaceTab, type WorkspaceTab } from "@/lib/ui-shell/resolve-ui-shell";
import {
  clearLastPojuWorkspaceSessionId,
  readLastPojuWorkspaceSessionId,
  writeLastPojuWorkspaceSessionId,
} from "@/lib/poju/workspace-last-session";
import { readPendingLangSwitch } from "@/lib/poju/pending-lang-switch";
import { getPathnameWithoutLocale } from "@/lib/i18n/pathname-without-locale";
import { parseAppLocale } from "@/lib/prompts/language-directive";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";
import { subscribeLocalOwnerKey } from "@/lib/storage/local-owner";

type Props = {
  initialTab: WorkspaceTab;
};

function isEngineProduct(tab: WorkspaceTab): tab is "atmos" | "poju" {
  return tab === "atmos" || tab === "poju";
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
  if (tab === "atmos") {
    return (
      <>
        <WorkspaceAtmosRightPanel />
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
      if (tab !== "atmos") {
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

/** Wire doc-vault card clicks → overlay modal (SoT 15). Center timeline untouched. */
function DocVaultOpenBinder({
  selectArchive,
  setTab,
  openRight,
}: {
  selectArchive: (product: WorkspaceProductId, id: string) => void;
  setTab: (tab: WorkspaceTab) => void;
  openRight: () => void;
}) {
  void setTab;
  const vault = useWorkspaceDocVaultOptional();
  const setOpenHandlers = vault?.setOpenHandlers;
  const [modalItem, setModalItem] = useState<DocVaultItem | null>(null);

  useEffect(() => {
    if (!setOpenHandlers) return;
    setOpenHandlers({
      openItem: async (item: DocVaultItem) => {
        const target = item.openTarget;
        // Baseline / delivery / report → modal only (0 PASS). Do not swap center to doc mode.
        if (
          target.type === "profile_matrix" ||
          target.type === "profile_report" ||
          target.type === "pivot_delivery" ||
          target.type === "pivot_reminders"
        ) {
          setModalItem(item);
          return;
        }
        if (target.type === "archive") {
          selectArchive(target.product, target.archiveId);
          openRight();
        }
      },
    });
    return () => setOpenHandlers(null);
  }, [setOpenHandlers, selectArchive, openRight]);

  /** After birth prepare: popup baseline over center welcome (does not replace chat). */
  useEffect(() => {
    const onAutoOpen = (event: Event) => {
      const detail = (event as CustomEvent<BaselineAutoOpenDetail>).detail;
      const profileId = detail?.profileId?.trim();
      if (!profileId) return;
      const id = DocVaultIds.matrix(profileId);
      const fromIndex = vault?.items.find((i) => i.id === id);
      const item: DocVaultItem = {
        ...(fromIndex ?? {
          id,
          section: "foundation",
          kind: "energy_matrix",
          title: "Baseline profile",
          subjectLabel: "",
          createdAt: new Date().toISOString(),
          unread: true,
          openTarget: { type: "profile_matrix", profileId },
        }),
        matrixPayload: detail?.matrixPayload ?? fromIndex?.matrixPayload ?? null,
      };
      markDocVaultRead(item.id);
      setModalItem(item);
    };
    window.addEventListener(BASELINE_AUTO_OPEN_EVENT, onAutoOpen);
    return () => window.removeEventListener(BASELINE_AUTO_OPEN_EVENT, onAutoOpen);
  }, [vault?.items]);

  /** SoT16: decision report opens as vault popup; center stays chat. */
  useEffect(() => {
    const onDeliveryOpen = (event: Event) => {
      const sessionId = (event as CustomEvent<DeliveryAutoOpenDetail>).detail?.sessionId?.trim();
      if (!sessionId) return;
      const id = DocVaultIds.delivery(sessionId);
      const fromIndex = vault?.items.find((i) => i.id === id);
      const item: DocVaultItem = fromIndex ?? {
        id,
        section: "pivot",
        kind: "pivot_delivery",
        title: "Decision report",
        subjectLabel: "",
        createdAt: new Date().toISOString(),
        unread: true,
        openTarget: { type: "pivot_delivery", sessionId },
      };
      markDocVaultRead(item.id);
      setModalItem(item);
    };
    window.addEventListener(DELIVERY_AUTO_OPEN_EVENT, onDeliveryOpen);
    return () => window.removeEventListener(DELIVERY_AUTO_OPEN_EVENT, onDeliveryOpen);
  }, [vault?.items]);

  return (
    <WorkspaceDocVaultModal
      item={modalItem}
      onClose={() => {
        const wasBaseline = modalItem?.kind === "energy_matrix";
        setModalItem(null);
        if (wasBaseline) {
          void import("@/lib/poju/joint-client-events").then((m) => {
            m.notifyJointPortraitClosed();
          });
        }
      }}
    />
  );
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
  const atmosWide = useWorkspaceAtmosRightRailWide();
  const rightWide = pojuWide || atmosWide;
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
  const atmosWide = useWorkspaceAtmosRightRailWide();
  const rightWide = pojuWide || atmosWide;
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
  const bare = getPathnameWithoutLocale(pathname || "/");
  return bare === "/app" || bare.startsWith("/app/");
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

  // One-shot hydrate when user is on POJU and idle (refresh / cold enter / locale switch).
  useEffect(() => {
    if (!resumeSession || tab !== "poju") return;
    if (phase !== "idle") return;
    if (!isWorkspaceAppPathname()) return;

    const urlSession = readAppQueryFromWindow().session?.trim() || sessionFromUrl?.trim() || null;
    // Mid-chat language switch: pending marker is authoritative if URL lost ?session=.
    const pending = readPendingLangSwitch();
    const pendingSession =
      pending && parseAppLocale(pending.targetLocale) === parseAppLocale(locale)
        ? pending.sessionId.trim()
        : "";
    const target = urlSession || pendingSession || null;
    if (!target) return;

    const key = `idle:${target}`;
    if (hydrateKeyRef.current === key) return;
    hydrateKeyRef.current = key;

    writeLastPojuWorkspaceSessionId(target);
    // Put session in the address bar immediately (pending may have restored it).
    if (readAppQueryFromWindow().session !== target) syncRef.current(target);
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
      if (product !== "atmos") {
        syncUrl("poju", null, null);
        setTab("poju");
        setArchiveId(null);
        return;
      }
      syncUrl("atmos", id, null);
      setTab("atmos");
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
      case "profile":
        return <ProfilePanel />;
      default:
        return <PojuPanel onOpenArchive={(id) => selectArchive("poju", id)} />;
    }
  }

  return (
    <AppDialogProvider>
      <WorkspaceDocVaultProvider>
      <WorkspacePojuPrepareProvider openRight={openRight}>
        <WorkspaceAtmosPrepareProvider openRight={openRight}>
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
        <AtmosPrepareResetBinder resetRef={atmosPrepareResetRef} />
        <PojuRightRailGate tab={tab} setRightOpen={setRightOpen} />
        <AtmosRightRailGate tab={tab} setRightOpen={setRightOpen} />
        <WorkspaceShellSurface sidebarCollapsed={sidebarCollapsed} rightOpen={rightOpen}>
        <WorkspaceStarfieldGate />
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
        </WorkspaceAtmosPrepareProvider>
      </WorkspacePojuPrepareProvider>
      </WorkspaceDocVaultProvider>
    </AppDialogProvider>
  );
}
