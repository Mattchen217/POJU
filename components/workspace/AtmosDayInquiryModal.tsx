"use client";

import { useEffect, useId, useState } from "react";

import type { AtmosQuickTag } from "@/lib/atmos/atmos-calendar-copy";

type Props = {
  title: string;
  hint: string;
  placeholder: string;
  tagsLabel: string;
  submitLabel: string;
  cancelLabel: string;
  /** YYYY-MM-DD */
  dateLabel: string;
  locale: string;
  quickTags: AtmosQuickTag[];
  busy?: boolean;
  onClose: () => void;
  onSubmit: (question: string) => void;
};

function formatExampleLine(tag: AtmosQuickTag, locale: string): string {
  const zh = locale.startsWith("zh");
  return zh ? `${tag.label}：${tag.prompt}` : `${tag.label}: ${tag.prompt}`;
}

export function AtmosDayInquiryModal({
  title,
  hint,
  placeholder,
  tagsLabel,
  submitLabel,
  cancelLabel,
  dateLabel,
  locale,
  quickTags,
  busy = false,
  onClose,
  onSubmit,
}: Props) {
  const titleId = useId();
  const [text, setText] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  function applyTag(tag: AtmosQuickTag) {
    setText(tag.prompt);
    setActiveTag(tag.id);
  }

  return (
    <div
      className="atmos-inquiry-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="atmos-inquiry-sheet">
        <button
          type="button"
          className="atmos-inquiry-sheet__close"
          onClick={onClose}
          disabled={busy}
          aria-label={cancelLabel}
        >
          ×
        </button>
        <p className="atmos-inquiry-sheet__date">{dateLabel}</p>
        <h2 id={titleId} className="atmos-inquiry-sheet__title">
          {title}
        </h2>
        <p className="atmos-inquiry-sheet__hint">{hint}</p>
        <label className="sr-only" htmlFor="atmos-day-inquiry">
          {placeholder}
        </label>
        <textarea
          id="atmos-day-inquiry"
          className="atmos-inquiry-sheet__input"
          rows={4}
          value={text}
          placeholder={placeholder}
          disabled={busy}
          onChange={(e) => {
            setText(e.target.value);
            setActiveTag(null);
          }}
        />
        <p className="atmos-inquiry-sheet__tags-label">{tagsLabel}</p>
        <div className="atmos-inquiry-sheet__examples" role="group" aria-label={tagsLabel}>
          {quickTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`atmos-inquiry-sheet__example${
                activeTag === tag.id ? " is-active" : ""
              }`}
              aria-pressed={activeTag === tag.id}
              disabled={busy}
              onClick={() => applyTag(tag)}
            >
              {formatExampleLine(tag, locale)}
            </button>
          ))}
        </div>
        <div className="atmos-inquiry-sheet__actions">
          <button
            type="button"
            className="atmos-inquiry-sheet__cancel"
            disabled={busy}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="atmos-inquiry-sheet__submit"
            disabled={busy}
            onClick={() => onSubmit(text.trim())}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
