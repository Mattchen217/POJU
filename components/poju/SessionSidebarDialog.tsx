"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SessionSidebarDialogState =
  | {
      kind: "rename";
      sessionId: string;
      defaultValue: string;
      anchor: DOMRect;
    }
  | {
      kind: "delete";
      sessionId: string;
      anchor: DOMRect;
    };

type SessionSidebarDialogProps = {
  dialog: SessionSidebarDialogState;
  renameTitle: string;
  renameMessage: string;
  deleteTitle: string;
  deleteMessage: string;
  cancelLabel: string;
  okLabel: string;
  onConfirmRename: (value: string) => void;
  onConfirmDelete: () => void;
  onCancel: () => void;
};

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

export function SessionSidebarDialog({
  dialog,
  renameTitle,
  renameMessage,
  deleteTitle,
  deleteMessage,
  cancelLabel,
  okLabel,
  onConfirmRename,
  onConfirmDelete,
  onCancel,
}: SessionSidebarDialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(dialog.kind === "rename" ? dialog.defaultValue : "");
  const [pos, setPos] = useState({ top: dialog.anchor.bottom + 8, left: dialog.anchor.left });

  useEffect(() => {
    if (dialog.kind === "rename") setValue(dialog.defaultValue);
  }, [dialog]);

  useEffect(() => {
    const panel = panelRef.current;
    const height = panel?.offsetHeight ?? (dialog.kind === "rename" ? 220 : 180);
    const width = panel?.offsetWidth ?? 320;
    setPos(placeNearAnchor(dialog.anchor, width, height));
  }, [dialog]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const isRename = dialog.kind === "rename";

  return (
    <>
      <div className="pchat__session-dialog-backdrop" role="presentation" onMouseDown={onCancel} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="pchat__session-dialog"
        style={{ top: pos.top, left: pos.left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="pchat__session-dialog__title">
          {isRename ? renameTitle : deleteTitle}
        </h2>
        <p id={descId} className="pchat__session-dialog__desc">
          {isRename ? renameMessage : deleteMessage}
        </p>
        {isRename ? (
          <input
            type="text"
            className="pchat__session-dialog__input"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onConfirmRename(value.trim());
              if (e.key === "Escape") onCancel();
            }}
          />
        ) : null}
        <div className="pchat__session-dialog__actions">
          <button type="button" className="pchat__session-dialog__cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`pchat__session-dialog__confirm${isRename ? "" : " is-danger"}`}
            onClick={() => {
              if (isRename) onConfirmRename(value.trim());
              else onConfirmDelete();
            }}
            disabled={isRename ? !value.trim() : false}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </>
  );
}
