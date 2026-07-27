"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";
import { GlyphCardIcon, MatchPairIcon, SyncroRadarIcon } from "@/components/workspace/workspace-engine-icons";
import { HOUR_PERIOD_INFO } from "@/lib/profile/types";
import type { StoredProfileSummary } from "@/lib/profile/stored-profiles-service";

/** Max profile cards before the card list scrolls (add-new stays pinned below). */
export const WORKSPACE_POJU_PROFILE_SCROLL_LIMIT = 3;

const RENAME_MAX_LEN = 48;

type ProductKey = "poju" | "match" | "atmos" | "syncro" | "glyph";

/** Pack used products left into 4 card slots (unused stay empty on the right). */
const PRODUCT_SLOTS: { key: ProductKey; usageKey: ProductKey }[] = [
  { key: "poju", usageKey: "poju" },
  { key: "match", usageKey: "match" },
  { key: "atmos", usageKey: "atmos" },
  { key: "syncro", usageKey: "syncro" },
  { key: "glyph", usageKey: "glyph" },
];

type Props = {
  profiles: StoredProfileSummary[];
  onSelect: (summary: StoredProfileSummary) => void;
  onAddNew: () => void;
  onRename: (profileId: string, nextName: string) => void;
  onDelete: (profileId: string) => void;
  /** Match-only: pinned dashed tip above the scrollable cards (non-interactive). */
  pinnedHint?: string;
};

type RenameDialogState = {
  profileId: string;
  defaultValue: string;
  anchor: DOMRect;
};

type DeleteDialogState = {
  profileId: string;
  title: string;
  anchor: DOMRect;
};

function padClock(n: number): string {
  return String(n).padStart(2, "0");
}

function formatBirthLine(p: StoredProfileSummary): string {
  const hour =
    typeof p.hour === "number" ? p.hour : HOUR_PERIOD_INFO[p.hour_period].representative_hour;
  const minute = typeof p.minute === "number" ? p.minute : 0;
  return `${p.birth_date} · ${padClock(hour)}:${padClock(minute)} · ${p.gender}`;
}

/** Card title: custom display_name, else the fixed birth line. */
export function getWorkspaceProfileCardTitle(p: StoredProfileSummary): string {
  const birth = formatBirthLine(p);
  const named = p.display_name?.trim();
  if (!named || named === birth) return birth;
  // Legacy auto names also start with birth_date and end with · M/F — keep clock birth line.
  if (named.startsWith(`${p.birth_date} · `) && named.endsWith(` · ${p.gender}`)) {
    return birth;
  }
  return named;
}

function formatCreatedAt(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : locale, {
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

function placeNearAnchor(rect: DOMRect, panelWidth: number, panelHeight: number) {
  const pad = 8;
  let top = rect.bottom + pad;
  let left = rect.right - panelWidth;
  if (left < pad) left = pad;
  if (left + panelWidth > window.innerWidth - pad) {
    left = window.innerWidth - panelWidth - pad;
  }
  if (top + panelHeight > window.innerHeight - pad) {
    top = Math.max(pad, rect.top - panelHeight - pad);
  }
  return { top, left };
}

function ProductUsageIcon({
  product,
  count,
}: {
  product: ProductKey | null;
  count: number;
}) {
  if (!product || count <= 0) {
    return <span className="workspace-poju-card__product workspace-poju-card__product--empty" aria-hidden />;
  }

  return (
    <span className="workspace-poju-card__product" title={`${product} ×${count}`}>
      <span className="workspace-poju-card__product-icon" aria-hidden>
        {product === "poju" ? (
          <span className="material-symbols-outlined">self_improvement</span>
        ) : null}
        {product === "match" ? <MatchPairIcon className="workspace-poju-card__glyph-svg" /> : null}
        {product === "atmos" ? (
          <span className="material-symbols-outlined">blur_on</span>
        ) : null}
        {product === "syncro" ? <SyncroRadarIcon className="workspace-poju-card__glyph-svg" /> : null}
        {product === "glyph" ? <GlyphCardIcon className="workspace-poju-card__glyph-svg" /> : null}
      </span>
      <span className="workspace-poju-card__product-count" aria-hidden>
        ×{count}
      </span>
    </span>
  );
}

/** Always 4 slots; used products pack left so unused stay on the right. */
function productSlotsForProfile(p: StoredProfileSummary): Array<{ key: ProductKey | null; count: number }> {
  const used = PRODUCT_SLOTS.filter((slot) => (p.used_in_products[slot.usageKey] ?? 0) > 0).map(
    (slot) => ({
      key: slot.key as ProductKey | null,
      count: p.used_in_products[slot.usageKey] ?? 0,
    }),
  );
  return Array.from({ length: 4 }, (_, i) => used[i] ?? { key: null, count: 0 });
}

function ProfileRenameDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: RenameDialogState;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const t = useTranslations("session_prep");
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(state.defaultValue);
  const [pos, setPos] = useState({ top: state.anchor.bottom + 8, left: state.anchor.left });

  useEffect(() => {
    setValue(state.defaultValue);
  }, [state]);

  useEffect(() => {
    const panel = panelRef.current;
    const height = panel?.offsetHeight ?? 200;
    const width = panel?.offsetWidth ?? 320;
    setPos(placeNearAnchor(state.anchor, width, height));
  }, [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== state.defaultValue.trim();

  return (
    <>
      <div
        className="workspace-poju-rename-backdrop"
        role="presentation"
        onMouseDown={onCancel}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="workspace-poju-rename-dialog"
        style={{ top: pos.top, left: pos.left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="workspace-poju-rename-dialog__body">
          <h2 id={titleId} className="workspace-poju-rename-dialog__title">
            {t("rename")}
          </h2>
          <p id={descId} className="workspace-poju-rename-dialog__desc">
            {t("rename_prompt")}
          </p>
          <input
            type="text"
            className="workspace-poju-rename-dialog__input"
            value={value}
            maxLength={RENAME_MAX_LEN}
            autoFocus
            onChange={(e) => setValue(e.target.value.slice(0, RENAME_MAX_LEN))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) onConfirm(trimmed);
              if (e.key === "Escape") onCancel();
            }}
          />
          <div className="workspace-poju-rename-dialog__actions">
            <button type="button" className="workspace-poju-rename-dialog__cancel" onClick={onCancel}>
              {t("rename_cancel")}
            </button>
            <button
              type="button"
              className="workspace-poju-rename-dialog__confirm"
              disabled={!canSave}
              onClick={() => onConfirm(trimmed)}
            >
              {t("rename_save")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileDeleteDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: DeleteDialogState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("session_prep");
  const tCommon = useTranslations("common");
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: state.anchor.bottom + 8, left: state.anchor.left });

  useEffect(() => {
    const panel = panelRef.current;
    const height = panel?.offsetHeight ?? 180;
    const width = panel?.offsetWidth ?? 320;
    setPos(placeNearAnchor(state.anchor, width, height));
  }, [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <>
      <div
        className="workspace-poju-rename-backdrop"
        role="presentation"
        onMouseDown={onCancel}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="workspace-poju-rename-dialog"
        style={{ top: pos.top, left: pos.left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="workspace-poju-rename-dialog__status" aria-hidden>
          <span>Core status: compromised</span>
          <span className="material-symbols-outlined text-[16px] leading-none">warning</span>
        </div>
        <div className="workspace-poju-rename-dialog__body">
          <h2 id={titleId} className="workspace-poju-rename-dialog__title">
            {t("delete")}
          </h2>
          <p id={descId} className="workspace-poju-rename-dialog__desc">
            {tCommon("deleteConfirmWarning")}
            {state.title ? (
              <>
                <br />
                <span className="workspace-poju-rename-dialog__target">{state.title}</span>
              </>
            ) : null}
          </p>
          <div className="workspace-poju-rename-dialog__actions">
            <button type="button" className="workspace-poju-rename-dialog__cancel" onClick={onCancel}>
              {t("rename_cancel")}
            </button>
            <button
              type="button"
              className="workspace-poju-rename-dialog__confirm is-danger"
              autoFocus
              onClick={onConfirm}
            >
              {t("delete")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileCardMenu({
  profileId,
  open,
  onOpenChange,
  onRename,
  onDelete,
}: {
  profileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (profileId: string, anchor: DOMRect) => void;
  onDelete: (profileId: string, anchor: DOMRect) => void;
}) {
  const t = useTranslations("session_prep");
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    const btn = buttonRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      onOpenChange(false);
    };
    const onReposition = () => onOpenChange(false);
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, onOpenChange]);

  function anchorFromEvent(e: React.MouseEvent): DOMRect {
    return (
      buttonRef.current?.getBoundingClientRect() ??
      new DOMRect(e.clientX, e.clientY, 0, 0)
    );
  }

  return (
    <div ref={rootRef} className="workspace-poju-card__menu">
      <button
        ref={buttonRef}
        type="button"
        className="workspace-poju-card__meatball"
        aria-label={t("card_menu")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <span className="material-symbols-outlined" aria-hidden>
          more_horiz
        </span>
      </button>
      {open && menuPos ? (
        <ul
          className="workspace-poju-card__meatball-menu"
          role="menu"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
                onRename(profileId, anchorFromEvent(e));
              }}
            >
              {t("rename")}
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="is-danger"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
                onDelete(profileId, anchorFromEvent(e));
              }}
            >
              {t("delete")}
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Returning-user list: scrollable cards + pinned “Enter new info” at frame bottom.
 * Single-row cards: title · created · product icons · ··· menu.
 */
export function WorkspacePojuProfileRecords({
  profiles,
  onSelect,
  onAddNew,
  onRename,
  onDelete,
  pinnedHint,
}: Props) {
  const t = useTranslations("session_prep");
  const locale = useLocale();
  const scrollable = profiles.length > WORKSPACE_POJU_PROFILE_SCROLL_LIMIT;
  const [menuProfileId, setMenuProfileId] = useState<string | null>(null);
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);

  function openRename(profileId: string, anchor: DOMRect) {
    const profile = profiles.find((p) => p.profile_id === profileId);
    if (!profile) return;
    setDeleteDialog(null);
    setRenameDialog({
      profileId,
      defaultValue: getWorkspaceProfileCardTitle(profile),
      anchor,
    });
  }

  function openDelete(profileId: string, anchor: DOMRect) {
    const profile = profiles.find((p) => p.profile_id === profileId);
    if (!profile) return;
    setRenameDialog(null);
    setDeleteDialog({
      profileId,
      title: getWorkspaceProfileCardTitle(profile),
      anchor,
    });
  }

  return (
    <div
      className={`workspace-poju-records${scrollable ? " is-scrollable" : " is-fit"}`}
      data-profile-count={profiles.length}
    >
      {pinnedHint ? (
        <div className="add-new-card-button workspace-poju-add-new workspace-poju-match-hint" role="status">
          <span className="workspace-poju-match-hint__text">{pinnedHint}</span>
        </div>
      ) : null}

      <WorkspaceScrollArea
        className="workspace-poju-records__scroll"
        viewportClassName="workspace-poju-records__viewport"
        fixedThumbPx={52}
      >
        <div className="workspace-poju-records__stack">
          {profiles.map((p) => {
            const title = getWorkspaceProfileCardTitle(p);
            return (
              <div
                key={p.profile_id}
                className="workspace-poju-profile-card"
                role="button"
                tabIndex={0}
                onClick={() => onSelect(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(p);
                  }
                }}
              >
                <div className="workspace-poju-card__row">
                  <span className="workspace-poju-card__birth" title={title}>
                    {title}
                  </span>
                  <span className="workspace-poju-card__created">
                    {t("created_at", { date: formatCreatedAt(p.created_at, locale) })}
                  </span>
                  <div className="workspace-poju-card__products" aria-label="product usage">
                    {productSlotsForProfile(p).map((slot, i) => (
                      <ProductUsageIcon key={`${p.profile_id}-slot-${i}`} product={slot.key} count={slot.count} />
                    ))}
                  </div>
                  <ProfileCardMenu
                    profileId={p.profile_id}
                    open={menuProfileId === p.profile_id}
                    onOpenChange={(open) => setMenuProfileId(open ? p.profile_id : null)}
                    onRename={openRename}
                    onDelete={openDelete}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </WorkspaceScrollArea>

      <button type="button" className="add-new-card-button workspace-poju-add-new" onClick={onAddNew}>
        <span>{t("enter_new_info")}</span>
        <span className="workspace-poju-add-new__arrow" aria-hidden>
          →
        </span>
      </button>

      {renameDialog ? (
        <ProfileRenameDialog
          state={renameDialog}
          onCancel={() => setRenameDialog(null)}
          onConfirm={(nextName) => {
            const { profileId } = renameDialog;
            setRenameDialog(null);
            onRename(profileId, nextName);
          }}
        />
      ) : null}

      {deleteDialog ? (
        <ProfileDeleteDialog
          state={deleteDialog}
          onCancel={() => setDeleteDialog(null)}
          onConfirm={() => {
            const { profileId } = deleteDialog;
            setDeleteDialog(null);
            onDelete(profileId);
          }}
        />
      ) : null}
    </div>
  );
}
