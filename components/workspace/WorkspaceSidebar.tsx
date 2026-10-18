"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useAppDialog } from "@/components/ui/app-dialog";
import { WorkspaceAccountPlaceholder } from "@/components/workspace/WorkspaceAccountPlaceholder";
import { WorkspaceLanguageSwitcher } from "@/components/workspace/WorkspaceLanguageSwitcher";
import { WorkspaceLegalMenu } from "@/components/workspace/WorkspaceLegalMenu";
import { WorkspacePassRow } from "@/components/workspace/WorkspacePassRow";
import { WorkspaceSidebarDockToggle } from "@/components/workspace/WorkspaceSidebarDockToggle";
import { PojuLogo } from "@/components/ui/poju-logo";
import {
  useWorkspaceProductHistory,
  type WorkspaceProductId,
} from "@/components/workspace/use-workspace-product-history";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
import { useRouter } from "@/i18n/navigation";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import {
  deleteArchiveItem,
  renameArchiveItem,
  type ArchiveSummary,
} from "@/lib/archive/archive-service";
import {
  deletePojuSessionHistory,
  renamePojuSessionHistory,
} from "@/lib/archive/poju-session-vault";
import type { WorkspaceTab } from "@/lib/ui-shell/resolve-ui-shell";

const PROGRESS_HIDE_KEY = "eos.workspace.progressStripHidden";

function formatArchiveCreatedAt(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

function formatSessionTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

function startOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d >= startOfLocalDay();
}

/** Strip product prefix from history titles for first-sentence snippet. */
function sessionSnippet(title: string): string {
  const t = title.trim();
  const stripped = t.replace(/^POJU[:\uFF1A]\s*/i, "").trim();
  return stripped || t;
}

type Props = {
  activeTab: WorkspaceTab;
  activeArchiveId: string | null;
  /** Switch engine without resetting in-progress flow. Kept for shell API; left rail no longer peers engines. */
  onSelectTab: (tab: WorkspaceTab) => void;
  /** Explicit New 鈥?reset that product to entry. */
  onSelectNew: (tab: WorkspaceTab) => void;
  onSelectArchive: (product: WorkspaceProductId, archiveId: string) => void;
  onSelectProfile: () => void;
  onLocaleChange?: () => void;
  collapsed?: boolean;
  /** Desktop: collapse/expand control beside brand wordmark */
  onToggleCollapse?: () => void;
  /** When false, brand row is rendered outside (desktop chrome). Default true. */
  showBrand?: boolean;
};

/** Brand lockup + optional dock toggle 鈥?used in desktop chrome or mobile sidebar. */
export function WorkspaceSidebarBrand({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <div className={`workspace-sidebar__brand${collapsed ? " is-collapsed" : ""}`}>
      <PojuLogo
        className="workspace-sidebar__brand-link"
        hardNavigate
        compact={collapsed}
        size="sidebar"
      />
      {onToggleCollapse ? (
        <WorkspaceSidebarDockToggle collapsed={collapsed} onToggle={onToggleCollapse} />
      ) : null}
    </div>
  );
}

function HistoryItemRow({
  row,
  active,
  onOpen,
  onChanged,
  onRemoved,
  onDeletedActive,
}: {
  row: ArchiveSummary;
  active: boolean;
  onOpen: () => void;
  onChanged: () => void;
  onRemoved: (id: string) => void;
  onDeletedActive: () => void;
}) {
  const t = useTranslations("workspace.density");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { confirm } = useAppDialog();
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const title = row.title || t("untitled");
  const snippet = sessionSnippet(title);
  const timeLabel = formatSessionTime(row.created_at, locale);
  const createdLabel = formatArchiveCreatedAt(row.created_at, locale);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [menuOpen]);

  async function handleRename() {
    setMenuOpen(false);
    const next = window.prompt(t("renamePrompt"), title);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === title) return;
    try {
      if (row.session_id) {
        await renamePojuSessionHistory(row.session_id, trimmed, locale);
      } else {
        await renameArchiveItem(row.archive_id, trimmed);
      }
      onChanged();
    } catch {
      /* ignore */
    }
  }

  async function handleDelete() {
    setMenuOpen(false);
    const ok = await confirm(tCommon("deleteConfirmWarning"), t("delete"), {
      confirmLabel: t("delete"),
      cancelLabel: t("newConfirmCancel"),
      tone: "danger",
      target: title,
    });
    if (!ok) return;
    try {
      if (row.session_id) {
        await deletePojuSessionHistory(row.session_id);
      } else {
        await deleteArchiveItem(row.archive_id);
      }
      onRemoved(row.session_id || row.archive_id);
      if (active) onDeletedActive();
      onChanged();
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      ref={rootRef}
      className={`workspace-sidebar__history-row${active ? " is-active" : ""}`}
    >
      <button
        type="button"
        className="workspace-sidebar__subitem workspace-sidebar__subitem--doc"
        aria-current={active ? "page" : undefined}
        onClick={onOpen}
        title={`${snippet}\n${createdLabel}`}
      >
        <span className="workspace-sidebar__submeta">
          <span className="workspace-sidebar__subtime">{timeLabel}</span>
          <span className="workspace-sidebar__sublabel">{snippet}</span>
        </span>
      </button>
      <div className="workspace-sidebar__history-menu">
        <button
          type="button"
          className="workspace-sidebar__meatball"
          aria-label={t("historyMenu")}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            more_vert
          </span>
        </button>
        {menuOpen ? (
          <ul className="workspace-sidebar__meatball-menu" role="menu">
            <li role="none">
              <button type="button" role="menuitem" onClick={() => void handleRename()}>
                {t("rename")}
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => void handleDelete()}
              >
                {t("delete")}
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** Custom left-rail scrollbar for past sessions only. */
function PastSessionsScroll({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0, visible: false });

  const syncThumb = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight - clientHeight;
    if (overflow <= 4) {
      setThumb({ top: 0, height: 0, visible: false });
      return;
    }
    const trackH = clientHeight;
    const natural = (clientHeight / scrollHeight) * trackH;
    const height = Math.max(14, Math.min(natural, trackH / 3));
    const maxTop = Math.max(0, trackH - height);
    const top = maxTop * (scrollTop / overflow);
    setThumb({ top, height, visible: true });
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    syncThumb();
    el.addEventListener("scroll", syncThumb, { passive: true });
    const ro = new ResizeObserver(() => syncThumb());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", syncThumb);
      ro.disconnect();
    };
  }, [syncThumb, children]);

  return (
    <div className="workspace-sidebar__past-scroll">
      <div ref={viewportRef} className="workspace-sidebar__past-list">
        {children}
      </div>
      {thumb.visible ? (
        <div className="workspace-sidebar__past-rail" aria-hidden>
          <div
            className="workspace-sidebar__past-thumb"
            style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ProgressStrip({
  collapsed,
  onHide,
}: {
  collapsed: boolean;
  onHide: () => void;
}) {
  const t = useTranslations("workspace.progress");
  const prepare = useWorkspacePojuPrepareOptional();
  const phase = prepare?.phase ?? "idle";
  const chatOn = phase === "chat" || phase === "preparing" || phase === "handoff";
  const reportOn = Boolean(prepare?.session);
  // 30-day is Atmos-adjacent; show muted until session has delivery context
  const day30On = false;

  if (collapsed) return null;

  return (
    <div className="workspace-progress-strip" role="status">
      <div className="workspace-progress-strip__chips">
        <span className={`workspace-progress-strip__chip${chatOn ? " is-on" : ""}`}>
          {t("chat")}
        </span>
        <span className={`workspace-progress-strip__chip${reportOn ? " is-on" : ""}`}>
          {t("report")}
        </span>
        <span className={`workspace-progress-strip__chip${day30On ? " is-on" : ""}`}>
          {t("day30")}
        </span>
      </div>
      <button
        type="button"
        className="workspace-progress-strip__hide"
        onClick={onHide}
        aria-label={t("hide")}
        title={t("hide")}
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden>
          close
        </span>
      </button>
    </div>
  );
}

export function WorkspaceSidebar({
  activeTab,
  activeArchiveId,
  onSelectTab: _onSelectTab,
  onSelectNew,
  onSelectArchive,
  onSelectProfile,
  onLocaleChange,
  collapsed = false,
  onToggleCollapse,
  showBrand = true,
}: Props) {
  const t = useTranslations("workspace.density");
  const tWs = useTranslations("workspace");
  const tRail = useTranslations("workspace.rail");
  const tProfile = useTranslations("workspace.profile");
  const { confirm } = useAppDialog();
  const router = useRouter();
  const { user, email, ready } = useAuthUser();
  const prepare = useWorkspacePojuPrepareOptional();
  const { items, ready: historyReady, refresh, removeLocal } = useWorkspaceProductHistory("poju", 40);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [progressHidden, setProgressHidden] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setProgressHidden(window.localStorage.getItem(PROGRESS_HIDE_KEY) === "1");
    } catch {
      setProgressHidden(false);
    }
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const activeHistoryId =
    prepare?.phase === "chat"
      ? prepare.resumingSessionId || prepare.session?.session_id || null
      : activeArchiveId;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      const title = (row.title || "").toLowerCase();
      return title.includes(q) || sessionSnippet(row.title || "").toLowerCase().includes(q);
    });
  }, [items, searchQuery]);

  const todayItems = useMemo(() => filtered.filter((r) => isToday(r.created_at)), [filtered]);
  const earlierItems = useMemo(() => filtered.filter((r) => !isToday(r.created_at)), [filtered]);

  const alreadyOnNewHome =
    activeTab === "poju" &&
    !activeArchiveId &&
    (prepare?.phase ?? "idle") === "idle";

  async function requestNew() {
    if (alreadyOnNewHome) return;
    const ok = await confirm(t("newConfirmBody"), t("newConfirmTitle"), {
      confirmLabel: t("newConfirmOk"),
      cancelLabel: t("newConfirmCancel"),
    });
    if (!ok) return;
    onSelectNew("poju");
  }

  function hideProgress() {
    setProgressHidden(true);
    try {
      window.localStorage.setItem(PROGRESS_HIDE_KEY, "1");
    } catch {
      /* private mode */
    }
  }

  function handleUserClick() {
    if (!ready) return;
    if (user) {
      onSelectProfile();
      return;
    }
    router.push("/login?next=/app");
  }

  function renderSessionGroup(label: string, rows: ArchiveSummary[]) {
    if (rows.length === 0) return null;
    return (
      <div className="workspace-sidebar__session-group">
        {!collapsed ? (
          <p className="workspace-sidebar__session-group-label">{label}</p>
        ) : null}
        {rows.map((row) => (
          <HistoryItemRow
            key={row.archive_id}
            row={row}
            active={activeHistoryId === row.archive_id || activeHistoryId === row.session_id}
            onOpen={() => onSelectArchive("poju", row.session_id || row.archive_id)}
            onChanged={() => void refresh()}
            onRemoved={removeLocal}
            onDeletedActive={() => onSelectNew("poju")}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`workspace-sidebar${collapsed ? " is-collapsed" : ""}`}>
      {showBrand ? (
        <WorkspaceSidebarBrand collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      ) : null}

      <nav className="workspace-sidebar__nav" aria-label={tRail("navLabel")}>
        {/* New session */}
        <button
          type="button"
          className={`workspace-sidebar__item workspace-sidebar__item--solo${
            alreadyOnNewHome ? " is-active" : ""
          }`}
          aria-current={alreadyOnNewHome ? "page" : undefined}
          data-tooltip={t("newSession")}
          onClick={() => void requestNew()}
        >
          <span className="workspace-sidebar__icon" aria-hidden>
            <span className="material-symbols-outlined">add</span>
          </span>
          <span className="workspace-sidebar__label">{t("newSession")}</span>
        </button>

        {/* Search sessions */}
        <button
          type="button"
          className={`workspace-sidebar__item workspace-sidebar__item--solo${
            searchOpen ? " is-active" : ""
          }`}
          aria-expanded={searchOpen}
          data-tooltip={tRail("searchSessions")}
          onClick={() => setSearchOpen((v) => !v)}
        >
          <span className="workspace-sidebar__icon" aria-hidden>
            <span className="material-symbols-outlined">search</span>
          </span>
          <span className="workspace-sidebar__label">{tRail("searchSessions")}</span>
        </button>
        {searchOpen && !collapsed ? (
          <div className="workspace-sidebar__search">
            <input
              ref={searchRef}
              type="search"
              className="workspace-sidebar__search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tRail("searchPlaceholder")}
              aria-label={tRail("searchSessions")}
            />
          </div>
        ) : null}

        {/* Past sessions */}
        <div className="workspace-sidebar__past-block">
          {!collapsed ? (
            <p className="workspace-sidebar__section-label">
              {t("pastSessions", { count: historyReady ? items.length : 0 })}
            </p>
          ) : (
            <button
              type="button"
              className="workspace-sidebar__item workspace-sidebar__item--solo"
              data-tooltip={tRail("pastSessionsShort")}
              aria-label={tRail("pastSessionsShort")}
            >
              <span className="workspace-sidebar__icon" aria-hidden>
                <span className="material-symbols-outlined">history</span>
              </span>
            </button>
          )}
          {!collapsed ? (
            <PastSessionsScroll>
              {!historyReady ? (
                <p className="workspace-sidebar__subempty">{t("historyLoading")}</p>
              ) : filtered.length === 0 ? (
                <p className="workspace-sidebar__subempty">{t("historyEmptyShort")}</p>
              ) : (
                <>
                  {renderSessionGroup(tRail("today"), todayItems)}
                  {renderSessionGroup(tRail("earlier"), earlierItems)}
                </>
              )}
            </PastSessionsScroll>
          ) : null}
        </div>

        {/* Optional Progress strip */}
        {!progressHidden ? (
          <ProgressStrip collapsed={collapsed} onHide={hideProgress} />
        ) : null}

        <div className="workspace-sidebar__divider" role="separator" />

        <div className="workspace-sidebar__bottom">
          <div className="workspace-sidebar__locale-slot">
            <WorkspaceLanguageSwitcher
              compact={collapsed}
              onAfterSelect={onLocaleChange}
            />
          </div>

          <button
            type="button"
            className={`workspace-sidebar__item workspace-sidebar__item--solo${
              activeTab === "profile" ? " is-active" : ""
            }`}
            aria-current={activeTab === "profile" ? "page" : undefined}
            data-tooltip={tRail("settings")}
            onClick={onSelectProfile}
          >
            <span className="workspace-sidebar__icon" aria-hidden>
              <span className="material-symbols-outlined">settings</span>
            </span>
            <span className="workspace-sidebar__label">{tRail("settings")}</span>
          </button>

          <WorkspaceAccountPlaceholder
            email={
              !ready
                ? tWs("guest")
                : user
                  ? email
                  : tProfile("loginCta")
            }
            active={activeTab === "profile"}
            onClick={handleUserClick}
            className="workspace-sidebar__account"
            compact={collapsed}
          />

          <WorkspacePassRow
            collapsed={collapsed}
            onOpenAccount={handleUserClick}
            className="workspace-sidebar__pass"
          />

          <div className="workspace-sidebar__legal-slot">
            <WorkspaceLegalMenu
              compact={collapsed}
              onAfterSelect={onLocaleChange}
            />
          </div>
        </div>
      </nav>
    </div>
  );
}
