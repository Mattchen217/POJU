"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useAppDialog } from "@/components/ui/app-dialog";
import { BrandLockup } from "@/components/marketing/brand-lockup";
import { WorkspaceAccountPlaceholder } from "@/components/workspace/WorkspaceAccountPlaceholder";
import { WorkspaceLanguageSwitcher } from "@/components/workspace/WorkspaceLanguageSwitcher";
import { WorkspaceLegalMenu } from "@/components/workspace/WorkspaceLegalMenu";
import { WorkspaceSidebarDockToggle } from "@/components/workspace/WorkspaceSidebarDockToggle";
import {
  GlyphCardIcon,
  MatchPairIcon,
  SyncroRadarIcon,
} from "@/components/workspace/workspace-engine-icons";
import {
  useWorkspaceProductHistory,
  type WorkspaceProductId,
} from "@/components/workspace/use-workspace-product-history";
import { useWorkspaceAtmosPrepareOptional } from "@/components/workspace/WorkspaceAtmosPrepareContext";
import { useWorkspaceMatchPrepareOptional } from "@/components/workspace/WorkspaceMatchPrepareContext";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
import { Link } from "@/i18n/navigation";
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

type EngineItem = {
  tab: WorkspaceTab;
  icon: ReactNode;
  /** true = all viewports; "mobile-only" = hide nested under desktop shell */
  nested?: boolean | "mobile-only";
};

const ENGINE_ITEMS: EngineItem[] = [
  {
    tab: "atmos",
    icon: <span className="material-symbols-outlined">blur_on</span>,
  },
  {
    tab: "poju",
    icon: <span className="material-symbols-outlined">self_improvement</span>,
    nested: true,
  },
  {
    tab: "match",
    icon: <MatchPairIcon />,
    nested: true,
  },
  {
    tab: "syncro",
    icon: <SyncroRadarIcon />,
    // Phone sensors only — no New / history under Syncro on desktop
    nested: "mobile-only",
  },
  {
    tab: "glyph",
    icon: <GlyphCardIcon />,
    nested: true,
  },
];

type Props = {
  activeTab: WorkspaceTab;
  activeArchiveId: string | null;
  /** Switch engine without resetting in-progress flow. */
  onSelectTab: (tab: WorkspaceTab) => void;
  /** Explicit New — reset that product to entry. */
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

/** Brand lockup + optional dock toggle — used in desktop chrome or mobile sidebar. */
export function WorkspaceSidebarBrand({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const tCommon = useTranslations("common");
  const brandLabel = tCommon("brand").replace(/^p/, "P");

  return (
    <div className={`workspace-sidebar__brand${collapsed ? " is-collapsed" : ""}`}>
      <Link
        href="/"
        className="workspace-sidebar__brand-link"
        aria-label={`${brandLabel} — ${tCommon("domain")}`}
      >
        <BrandLockup
          label={brandLabel}
          size="header"
          className="workspace-sidebar__brand-lockup"
        />
      </Link>
      {onToggleCollapse ? (
        <WorkspaceSidebarDockToggle collapsed={collapsed} onToggle={onToggleCollapse} />
      ) : null}
    </div>
  );
}

function HistoryItemRow({
  row,
  active,
  product,
  onOpen,
  onChanged,
  onDeletedActive,
}: {
  row: ArchiveSummary;
  active: boolean;
  product: WorkspaceProductId;
  onOpen: () => void;
  onChanged: () => void;
  onDeletedActive: () => void;
}) {
  const t = useTranslations("workspace.density");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { confirm } = useAppDialog();
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const title = row.title || t("untitled");
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
      if (product === "poju" && row.session_id) {
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
      if (product === "poju" && row.session_id) {
        await deletePojuSessionHistory(row.session_id);
      } else {
        await deleteArchiveItem(row.archive_id);
      }
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
        title={`${title}\n${createdLabel}`}
      >
        <span className="material-symbols-outlined workspace-sidebar__subicon" aria-hidden>
          description
        </span>
        <span className="workspace-sidebar__submeta">
          <span className="workspace-sidebar__sublabel">{title}</span>
          <span className="workspace-sidebar__subtime">{createdLabel}</span>
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

/** Custom left-rail scrollbar for past sessions only (unchanged from prior design). */
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

const PRODUCT_NEW_NAME: Record<Exclude<WorkspaceProductId, "poju">, string> = {
  match: "Match",
  syncro: "Syncro",
  glyph: "Glyph",
};

function ToolHistoryBranch({
  product,
  engineActive,
  expanded,
  activeArchiveId,
  nestFocus,
  onFocusNew,
  onFocusPast,
  onArchive,
  onDeletedActive,
}: {
  product: WorkspaceProductId;
  /** True when this product is the current workspace tab. */
  engineActive: boolean;
  expanded: boolean;
  activeArchiveId: string | null;
  nestFocus: "new" | "past" | null;
  onFocusNew: () => void;
  onFocusPast: () => void;
  onArchive: (id: string) => void;
  onDeletedActive: () => void;
}) {
  const t = useTranslations("workspace.density");
  const { confirm } = useAppDialog();
  const prepare = useWorkspacePojuPrepareOptional();
  const match = useWorkspaceMatchPrepareOptional();
  const atmos = useWorkspaceAtmosPrepareOptional();
  const { items, ready, refresh } = useWorkspaceProductHistory(product, 40);
  const [pastOpen, setPastOpen] = useState(false);

  const activeHistoryId =
    product === "poju" && prepare?.phase === "chat" && prepare.session?.session_id
      ? prepare.session.session_id
      : activeArchiveId;

  useEffect(() => {
    if (activeHistoryId) setPastOpen(true);
  }, [activeHistoryId]);

  if (!expanded) return null;

  const count = ready ? items.length : 0;
  const newLabel =
    product === "poju"
      ? t("newSession")
      : t("newProduct", { name: PRODUCT_NEW_NAME[product] });

  /* Home / new entry is already showing — New should no-op (no confirm). */
  const alreadyOnNewHome =
    engineActive &&
    !activeArchiveId &&
    ((product === "poju" && (prepare?.phase ?? "idle") === "idle") ||
      (product === "match" && (match?.phase ?? "entry") === "entry") ||
      (product === "atmos" && (atmos?.phase ?? "idle") === "idle") ||
      product === "syncro" ||
      product === "glyph");

  const newActive = alreadyOnNewHome || nestFocus === "new";
  const pastActive =
    nestFocus === "past" ||
    Boolean(activeArchiveId) ||
    (product === "poju" && prepare?.phase === "chat" && Boolean(prepare.session));

  async function requestNew() {
    if (alreadyOnNewHome) return;
    const ok = await confirm(t("newConfirmBody"), t("newConfirmTitle"), {
      confirmLabel: t("newConfirmOk"),
      cancelLabel: t("newConfirmCancel"),
    });
    if (!ok) return;
    onFocusNew();
  }

  return (
    <div className="workspace-sidebar__subnav" role="group">
      <button
        type="button"
        className={`workspace-sidebar__subitem workspace-sidebar__subitem--new${
          newActive ? " is-active" : ""
        }`}
        aria-current={newActive ? "page" : undefined}
        onClick={() => void requestNew()}
      >
        <span className="material-symbols-outlined workspace-sidebar__subicon" aria-hidden>
          add
        </span>
        <span className="workspace-sidebar__label">{newLabel}</span>
      </button>

      <button
        type="button"
        className={`workspace-sidebar__subitem workspace-sidebar__past-toggle${
          pastActive ? " is-active" : ""
        }`}
        aria-expanded={pastOpen}
        aria-current={pastActive && !activeArchiveId ? "page" : undefined}
        onClick={() => {
          onFocusPast();
          setPastOpen((v) => (pastActive ? !v : true));
        }}
      >
        <span className="material-symbols-outlined workspace-sidebar__subicon" aria-hidden>
          {pastOpen ? "folder_open" : "folder"}
        </span>
        <span className="workspace-sidebar__label workspace-sidebar__past-label">
          {t(product === "poju" ? "pastSessions" : "pastRecords", { count })}
        </span>
        <span className="workspace-sidebar__past-chevron" aria-hidden>
          {pastOpen ? "▾" : "▸"}
        </span>
      </button>

      {pastOpen ? (
        <PastSessionsScroll>
          {!ready ? (
            <p className="workspace-sidebar__subempty">{t("historyLoading")}</p>
          ) : items.length === 0 ? (
            <p className="workspace-sidebar__subempty">{t("historyEmptyShort")}</p>
          ) : (
            items.map((row) => (
              <HistoryItemRow
                key={row.archive_id}
                row={row}
                product={product}
                active={activeHistoryId === row.archive_id}
                onOpen={() => onArchive(row.archive_id)}
                onChanged={() => void refresh()}
                onDeletedActive={onDeletedActive}
              />
            ))
          )}
        </PastSessionsScroll>
      ) : null}
    </div>
  );
}

export function WorkspaceSidebar({
  activeTab,
  activeArchiveId,
  onSelectTab,
  onSelectNew,
  onSelectArchive,
  onSelectProfile,
  onLocaleChange,
  collapsed = false,
  onToggleCollapse,
  showBrand = true,
}: Props) {
  const t = useTranslations("workspace.tabs");
  const tBlurb = useTranslations("workspace.blurb");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  /** Sibling focus under an engine: New XOR Past — never both. */
  const [nestFocus, setNestFocus] = useState<Record<string, "new" | "past" | null>>({});
  // Default desktop-safe so Syncro nested does not flash on SSR/desktop hydrate
  const [isDesktop, setIsDesktop] = useState(true);
  const prevTabRef = useRef(activeTab);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (collapsed) return;
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    const canNest =
      activeTab === "poju" ||
      activeTab === "match" ||
      activeTab === "glyph" ||
      (activeTab === "syncro" && !isDesktop);
    if (canNest) {
      setExpanded((prev) => ({ ...prev, [activeTab]: true }));
    }
  }, [activeTab, collapsed, isDesktop]);

  return (
    <div className={`workspace-sidebar${collapsed ? " is-collapsed" : ""}`}>
      {showBrand ? (
        <WorkspaceSidebarBrand collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      ) : null}

      <nav className="workspace-sidebar__nav" aria-label="Workspace engines">
        {ENGINE_ITEMS.map(({ tab, icon, nested }) => {
          const isActive = activeTab === tab;
          const showNested =
            nested === true || (nested === "mobile-only" && !isDesktop);
          const isOpen = !collapsed && showNested && Boolean(expanded[tab]);
          const label = t(tab);
          const blurb = tBlurb(tab);
          return (
            <div
              key={tab}
              className="workspace-sidebar__group"
              data-engine={tab}
            >
              <button
                type="button"
                className="workspace-sidebar__item"
                aria-current={isActive ? "page" : undefined}
                aria-expanded={showNested ? isOpen : undefined}
                aria-label={`${label}. ${blurb}`}
                data-tooltip={label}
                onClick={() => {
                  if (!showNested || collapsed) {
                    setNestFocus((prev) => ({ ...prev, [tab]: null }));
                    onSelectTab(tab);
                    return;
                  }
                  /* Already on this engine: toggle nest only — do not navigate / reset home. */
                  if (isActive) {
                    setExpanded((prev) => ({ ...prev, [tab]: !isOpen }));
                    return;
                  }
                  setExpanded((prev) => ({ ...prev, [tab]: true }));
                  setNestFocus((prev) => ({ ...prev, [tab]: null }));
                  onSelectTab(tab);
                }}
              >
                <span className="workspace-sidebar__icon" aria-hidden>
                  {icon}
                </span>
                <span className="workspace-sidebar__text">
                  <span className="workspace-sidebar__label">{label}</span>
                  <span className="workspace-sidebar__blurb">{blurb}</span>
                </span>
              </button>
              {showNested ? (
                <ToolHistoryBranch
                  product={tab as WorkspaceProductId}
                  engineActive={isActive}
                  expanded={isOpen}
                  activeArchiveId={isActive ? activeArchiveId : null}
                  nestFocus={
                    isActive
                      ? activeArchiveId
                        ? "past"
                        : (nestFocus[tab] ?? null)
                      : null
                  }
                  onFocusNew={() => {
                    setNestFocus((prev) => ({ ...prev, [tab]: "new" }));
                    onSelectNew(tab);
                  }}
                  onFocusPast={() => {
                    setNestFocus((prev) => ({ ...prev, [tab]: "past" }));
                  }}
                  onArchive={(id) => {
                    setNestFocus((prev) => ({ ...prev, [tab]: "past" }));
                    onSelectArchive(tab as WorkspaceProductId, id);
                  }}
                  onDeletedActive={() => {
                    setNestFocus((prev) => ({ ...prev, [tab]: "new" }));
                    onSelectNew(tab);
                  }}
                />
              ) : null}
            </div>
          );
        })}

        <div className="workspace-sidebar__divider" role="separator" />

        <div className="workspace-sidebar__bottom">
          <WorkspaceAccountPlaceholder
            active={activeTab === "profile"}
            onClick={onSelectProfile}
            className="workspace-sidebar__account"
          />
          <div className="workspace-sidebar__legal-slot">
            <WorkspaceLegalMenu
              compact={collapsed}
              onAfterSelect={onLocaleChange}
            />
          </div>
          <div className="workspace-sidebar__locale-slot">
            <WorkspaceLanguageSwitcher
              compact={collapsed}
              onAfterSelect={onLocaleChange}
            />
          </div>
        </div>
      </nav>
    </div>
  );
}
