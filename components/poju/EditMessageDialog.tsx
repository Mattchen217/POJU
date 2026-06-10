"use client";

import { useEffect, useId, useRef, useState } from "react";

type EditMessageDialogProps = {
  open: boolean;
  title: string;
  description: string;
  defaultValue: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export function EditMessageDialog({
  open,
  title,
  description,
  defaultValue,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: EditMessageDialogProps) {
  const titleId = useId();
  const descId = useId();
  const [value, setValue] = useState(defaultValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  useEffect(() => {
    if (!open) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="pchat-edit-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="pchat-edit-panel"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="pchat-edit-panel__title">
          {title}
        </h2>
        <p id={descId} className="pchat-edit-panel__desc">
          {description}
        </p>
        <textarea
          ref={textareaRef}
          className="pchat-edit-panel__input"
          value={value}
          rows={4}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="pchat-edit-panel__actions">
          <button type="button" className="pchat-edit-panel__cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="pchat-edit-panel__confirm"
            onClick={() => onConfirm(value.trim())}
            disabled={!value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
