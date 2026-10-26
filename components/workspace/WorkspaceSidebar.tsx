"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";

import { useAppDialog } from "@/components/ui/app-dialog";
import { WorkspaceAccountPlaceholder } from "@/components/workspace/WorkspaceAccountPlaceholder";
import { WorkspaceLanguageSwitcher } from "@/components/workspace/WorkspaceLanguageSwitcher";
import { WorkspaceLegalMenu } from "@/components/workspace/WorkspaceLegalMenu";
import { WorkspacePassRow } from "@/components/workspace/WorkspacePassRow";
import { SessionStageTimeline } from "@/components/workspace/SessionStageTimeline";
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
import type { JointDecisionPublicView } from "@/lib/passes/household-types";
import {
  JOINT_LIST_UPDATED_EVENT,
  requestJointEntryMode,
  requestJointOpen,
} from "@/lib/poju/joint-client-events";
import type { WorkspaceTab } from "@/lib/ui-shell/resolve-ui-shell";


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

/** Hover tip for joint/solo CTAs — portaled above the page so sidebar overflow cannot clip it. */
function SidebarCtaHintButton({
  className,
  label,
  hintTitle,
  hintBody,
  ariaCurrent,
  onClick,
}: {
  className: string;
  label: string;
  hintTitle: string;
  hintBody: string;
  ariaCurrent?: "page" | undefined;
  onClick: () => void;
}) {
  const tipId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 10;
    const tipW = 300;
    let left = r.right + gap;
    if (left + tipW > window.innerWidth - 12) {
      left = Math.max(12, r.left - tipW - gap);
    }
    let top = r.top;
    const maxTop = window.innerHeight - 12;
    // Clamp after measuring approx height via CSS max-height
    if (top + 220 > maxTop) top = Math.max(12, maxTop - 220);
    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={className}
        aria-current={ariaCurrent}
        aria-describedby={open ? tipId : undefined}
        onClick={onClick}
        onMouseEnter={() => {
          place();
          setOpen(true);
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          place();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
      >
        <span className="workspace-sidebar__icon" aria-hidden>
          <span className="material-symbols-outlined">add</span>
        </span>
        <span className="workspace-sidebar__label">{label}</span>
      </button>
      {mounted && open && coords
        ? createPortal(
            <div
              id={tipId}
              role="tooltip"
              className="workspace-sidebar-cta-hint"
              style={{ top: coords.top, left: coords.left }}
            >
              <p className="workspace-sidebar-cta-hint__title">{hintTitle}</p>
              <p className="workspace-sidebar-cta-hint__body">{hintBody}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

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
  showTimeline = true,
}: {
  row: ArchiveSummary;
  active: boolean;
  onOpen: () => void;
  onChanged: () => void;
  onRemoved: (id: string) => void;
  onDeletedActive: () => void;
  showTimeline?: boolean;
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
  const birthLabel = row.birth_label?.trim() || "";
  /** Top line: birth · HH:mm (creation time stays hour+minute only). */
  const metaTop = birthLabel ? `${birthLabel} · ${timeLabel}` : timeLabel;

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
      <div className="workspace-sidebar__history-row-main">
      <button
        type="button"
        className="workspace-sidebar__subitem workspace-sidebar__subitem--doc"
        aria-current={active ? "page" : undefined}
        onClick={onOpen}
        title={[metaTop, snippet, createdLabel].filter(Boolean).join("\n")}
      >
        <span className="workspace-sidebar__icon" aria-hidden>
          <span className="material-symbols-outlined">chat_bubble</span>
        </span>
        <span className="workspace-sidebar__submeta">
          <span className="workspace-sidebar__subtime" title={metaTop}>
            {metaTop}
          </span>
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
      {showTimeline ? (
        <SessionStageTimeline stage={row.journey_stage ?? 1} />
      ) : null}
    </div>
  );
}

/** Custom left-rail scrollbar for past sessions only (scroll stays inside history). */
function PastSessionsScroll({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0, visible: false });

  const syncThumb = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight - clientHeight;
    if (overflow <= 4 || clientHeight <= 0) {
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

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const el = viewportRef.current;
      if (!drag || !el) return;
      const overflow = el.scrollHeight - el.clientHeight;
      if (overflow <= 4) return;
      const trackH = el.clientHeight;
      const thumbH = thumb.height || 14;
      const maxTop = Math.max(0, trackH - thumbH);
      if (maxTop <= 0) return;
      const deltaY = e.clientY - drag.startY;
      el.scrollTop = Math.min(
        overflow,
        Math.max(0, drag.startScroll + (deltaY / maxTop) * overflow),
      );
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [thumb.height]);

  function startThumbDrag(e: ReactPointerEvent) {
    const el = viewportRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startY: e.clientY, startScroll: el.scrollTop };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  function onRailPointerDown(e: ReactPointerEvent) {
    const el = viewportRef.current;
    const rail = railRef.current;
    if (!el || !rail) return;
    if ((e.target as HTMLElement).closest(".workspace-sidebar__past-thumb")) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = rail.getBoundingClientRect();
    const overflow = el.scrollHeight - el.clientHeight;
    if (overflow <= 4) return;
    const thumbH = thumb.height || 14;
    const y = e.clientY - rect.top - thumbH / 2;
    const maxTop = Math.max(0, rect.height - thumbH);
    const ratio = maxTop <= 0 ? 0 : Math.min(1, Math.max(0, y / maxTop));
    el.scrollTop = ratio * overflow;
    dragRef.current = { startY: e.clientY, startScroll: el.scrollTop };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  return (
    <div className="workspace-sidebar__past-scroll">
      <div ref={viewportRef} className="workspace-sidebar__past-list">
        {children}
      </div>
      {thumb.visible ? (
        <div
          ref={railRef}
          className="workspace-sidebar__past-rail"
          aria-hidden
          onPointerDown={onRailPointerDown}
        >
          <div
            className="workspace-sidebar__past-thumb"
            style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
            onPointerDown={startThumbDrag}
          />
        </div>
      ) : null}
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
  const tJoint = useTranslations("joint_flow");
  const { confirm } = useAppDialog();
  const router = useRouter();
  const { user, email, ready } = useAuthUser();
  const prepare = useWorkspacePojuPrepareOptional();
  const { items, ready: historyReady, refresh, removeLocal } = useWorkspaceProductHistory("poju", 40);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [joints, setJoints] = useState<JointDecisionPublicView[]>([]);
  const [jointsReady, setJointsReady] = useState(false);
  const [activeJointId, setActiveJointId] = useState<string | null>(null);
  /** Only one history panel open at a time; null = both collapsed. */
  const [historyOpen, setHistoryOpen] = useState<"joint" | "solo" | null>("solo");

  function toggleHistory(which: "joint" | "solo") {
    setHistoryOpen((prev) => (prev === which ? null : which));
  }

  const refreshJoints = useCallback(async () => {
    try {
      const res = await fetch("/api/joint/list", { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        joints?: JointDecisionPublicView[];
      };
      if (data.ok && Array.isArray(data.joints)) {
        setJoints(data.joints);
      }
    } catch {
      /* ignore */
    } finally {
      setJointsReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshJoints();
    function onUpdated() {
      void refreshJoints();
    }
    window.addEventListener(JOINT_LIST_UPDATED_EVENT, onUpdated);
    window.addEventListener("focus", onUpdated);
    return () => {
      window.removeEventListener(JOINT_LIST_UPDATED_EVENT, onUpdated);
      window.removeEventListener("focus", onUpdated);
    };
  }, [refreshJoints]);

  useEffect(() => {
    if (searchOpen && !collapsed) searchRef.current?.focus();
  }, [searchOpen, collapsed]);

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

  async function requestNewSolo() {
    if (alreadyOnNewHome && activeJointId == null) {
      requestJointEntryMode("solo");
      return;
    }
    const ok = await confirm(t("newConfirmBody"), t("newConfirmTitle"), {
      confirmLabel: t("newConfirmOk"),
      cancelLabel: t("newConfirmCancel"),
    });
    if (!ok) return;
    setActiveJointId(null);
    requestJointEntryMode("solo");
    onSelectNew("poju");
  }

  async function requestNewJoint() {
    const ok = await confirm(tJoint("newConfirmBody"), tJoint("newConfirmTitle"), {
      confirmLabel: t("newConfirmOk"),
      cancelLabel: t("newConfirmCancel"),
    });
    if (!ok) return;
    setActiveJointId(null);
    requestJointEntryMode("joint");
    onSelectNew("poju");
  }

  function openJointRow(id: string) {
    setActiveJointId(id);
    setHistoryOpen("joint");
    requestJointOpen(id);
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
            onOpen={() => {
              setActiveJointId(null);
              setHistoryOpen("solo");
              requestJointEntryMode("solo");
              onSelectArchive("poju", row.session_id || row.archive_id);
            }}
            onChanged={() => void refresh()}
            onRemoved={removeLocal}
            onDeletedActive={() => onSelectNew("poju")}
            showTimeline={!collapsed}
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
        {/* Search first — always-on capsule (expanded); icon when collapsed */}
        {!collapsed ? (
          <div className="workspace-sidebar__search workspace-sidebar__search--capsule">
            <span className="workspace-sidebar__search-icon" aria-hidden>
              <span className="material-symbols-outlined">search</span>
            </span>
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
        ) : (
          <button
            type="button"
            className="workspace-sidebar__item workspace-sidebar__item--solo"
            data-tooltip={tRail("searchSessions")}
            aria-label={tRail("searchSessions")}
            onClick={() => {
              onToggleCollapse?.();
              setSearchOpen(true);
            }}
          >
            <span className="workspace-sidebar__icon" aria-hidden>
              <span className="material-symbols-outlined">search</span>
            </span>
          </button>
        )}

        <div className="workspace-sidebar__divider" role="separator" />

        {/* Joint decision CTA + history */}
        <SidebarCtaHintButton
          className="workspace-sidebar__item workspace-sidebar__item--solo workspace-sidebar__item--cta"
          label={tJoint("cta_new")}
          hintTitle={tJoint("cta_joint_hint_title")}
          hintBody={tJoint("cta_joint_hint_body")}
          onClick={() => void requestNewJoint()}
        />

        <div className="workspace-sidebar__past-block workspace-sidebar__past-block--joint">
          {!collapsed ? (
            <button
              type="button"
              className="workspace-sidebar__section-label workspace-sidebar__section-label--toggle"
              aria-expanded={historyOpen === "joint"}
              aria-label={tJoint("history_toggle")}
              onClick={() => toggleHistory("joint")}
            >
              <span className="workspace-sidebar__section-label-icon" aria-hidden>
                <span className="material-symbols-outlined">history</span>
              </span>
              <span>
                {tJoint("history_label", { count: jointsReady ? joints.length : 0 })}
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="workspace-sidebar__item workspace-sidebar__item--solo"
              data-tooltip={tJoint("history_label", { count: joints.length })}
              aria-label={tJoint("history_label", { count: joints.length })}
              aria-expanded={historyOpen === "joint"}
              onClick={() => toggleHistory("joint")}
            >
              <span className="workspace-sidebar__icon" aria-hidden>
                <span className="material-symbols-outlined">history</span>
              </span>
            </button>
          )}
          {!collapsed && historyOpen === "joint" ? (
            <PastSessionsScroll>
              {!jointsReady ? (
                <p className="workspace-sidebar__subempty">{t("historyLoading")}</p>
              ) : joints.length === 0 ? (
                <p className="workspace-sidebar__subempty">{tJoint("history_empty")}</p>
              ) : (
                joints.map((j) => (
                  <div
                    key={j.id}
                    className={`workspace-sidebar__history-row${
                      activeJointId === j.id ? " is-active" : ""
                    }${j.unread ? " is-unread" : ""}`}
                  >
                    <button
                      type="button"
                      className="workspace-sidebar__subitem workspace-sidebar__subitem--doc"
                      aria-current={activeJointId === j.id ? "page" : undefined}
                      onClick={() => openJointRow(j.id)}
                      title={j.shared_question}
                    >
                      <span className="workspace-sidebar__icon" aria-hidden>
                        <span className="material-symbols-outlined">chat_bubble</span>
                        {j.unread ? (
                          <span className="workspace-sidebar__unread-dot" aria-hidden />
                        ) : null}
                      </span>
                      <span className="workspace-sidebar__submeta">
                        <span className="workspace-sidebar__subtime">
                          {j.waiting_for_partner
                            ? tJoint("status_waiting")
                            : j.my_charged
                              ? tJoint("status_running")
                              : j.partner_ready
                                ? tJoint("status_ready")
                                : tJoint("status_invited")}
                          {j.peer_label ? ` · ${j.peer_label}` : ""}
                        </span>
                        <span className="workspace-sidebar__sublabel">
                          {j.shared_question}
                        </span>
                      </span>
                    </button>
                  </div>
                ))
              )}
            </PastSessionsScroll>
          ) : null}
        </div>

        <div className="workspace-sidebar__divider" role="separator" />

        {/* Solo decision CTA + history */}
        <SidebarCtaHintButton
          className={`workspace-sidebar__item workspace-sidebar__item--solo workspace-sidebar__item--cta${
            alreadyOnNewHome && activeJointId == null ? " is-active" : ""
          }`}
          ariaCurrent={alreadyOnNewHome && activeJointId == null ? "page" : undefined}
          label={tJoint("cta_solo")}
          hintTitle={tJoint("cta_solo_hint_title")}
          hintBody={tJoint("cta_solo_hint_body")}
          onClick={() => void requestNewSolo()}
        />

        <div className="workspace-sidebar__past-block">
          {!collapsed ? (
            <button
              type="button"
              className="workspace-sidebar__section-label workspace-sidebar__section-label--toggle"
              aria-expanded={historyOpen === "solo"}
              aria-label={tJoint("history_toggle")}
              onClick={() => toggleHistory("solo")}
            >
              <span className="workspace-sidebar__section-label-icon" aria-hidden>
                <span className="material-symbols-outlined">history</span>
              </span>
              <span>{tJoint("solo_history", { count: historyReady ? items.length : 0 })}</span>
            </button>
          ) : (
            <button
              type="button"
              className="workspace-sidebar__item workspace-sidebar__item--solo"
              data-tooltip={tJoint("solo_history", { count: items.length })}
              aria-label={tJoint("solo_history", { count: items.length })}
              aria-expanded={historyOpen === "solo"}
              onClick={() => toggleHistory("solo")}
            >
              <span className="workspace-sidebar__icon" aria-hidden>
                <span className="material-symbols-outlined">history</span>
              </span>
            </button>
          )}
          {!collapsed && historyOpen === "solo" ? (
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


        <div className="workspace-sidebar__divider" role="separator" />

        <div className="workspace-sidebar__bottom">
          <div className="workspace-sidebar__locale-slot">
            <WorkspaceLanguageSwitcher
              compact={collapsed}
              onAfterSelect={onLocaleChange}
            />
          </div>


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
