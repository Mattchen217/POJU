"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ContextSummary } from "@/lib/poju/agent-state";

type Props = {
  summary: ContextSummary;
  busy?: boolean;
  onConfirm: (editedSummary: ContextSummary) => void;
  onCancel?: () => void;
  onAddMore?: (note: string) => void;
};

export function ContextSummaryEditor({ summary, busy, onConfirm, onCancel, onAddMore }: Props) {
  const t = useTranslations("poju.summary_editor");
  const [edited, setEdited] = useState<ContextSummary>(() => JSON.parse(JSON.stringify(summary)) as ContextSummary);
  const [editingItem, setEditingItem] = useState<{ section: number; item: number } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [additionalNote, setAdditionalNote] = useState("");
  const [showAddNote, setShowAddNote] = useState(false);

  function startEdit(sectionIdx: number, itemIdx: number) {
    setEditingValue(edited.sections[sectionIdx].items[itemIdx].value);
    setEditingItem({ section: sectionIdx, item: itemIdx });
  }

  function saveEdit() {
    if (!editingItem) return;
    const next = { ...edited, sections: edited.sections.map((s) => ({ ...s, items: [...s.items] })) };
    next.sections[editingItem.section].items[editingItem.item] = {
      ...next.sections[editingItem.section].items[editingItem.item],
      value: editingValue,
    };
    setEdited(next);
    setEditingItem(null);
    setEditingValue("");
  }

  function deleteItem(sectionIdx: number, itemIdx: number) {
    if (!window.confirm(t("confirm_delete_item"))) return;
    const next = { ...edited, sections: edited.sections.map((s) => ({ ...s, items: [...s.items] })) };
    next.sections[sectionIdx].items.splice(itemIdx, 1);
    setEdited(next);
  }

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-950/25 p-4 text-sm shadow-lg">
      <h3 className="text-base font-semibold text-amber-100">{t("title")}</h3>
      <p className="mt-1 text-xs text-on-surface-variant">{t("description")}</p>
      <div className="mt-4 space-y-4">
        {edited.sections.map((sec, sIdx) => (
          <div key={sec.section_id}>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">{sec.title}</p>
            <ul className="mt-2 space-y-2">
              {sec.items.map((item, iIdx) => (
                <li key={item.item_id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[11px] text-on-surface-variant">{item.label}</p>
                  {editingItem?.section === sIdx && editingItem?.item === iIdx ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm text-on-surface"
                      />
                      <div className="flex gap-2">
                        <button type="button" className="rounded-md bg-primary px-2 py-1 text-xs text-on-primary" onClick={saveEdit}>
                          {t("save")}
                        </button>
                        <button type="button" className="rounded-md border border-white/20 px-2 py-1 text-xs" onClick={() => setEditingItem(null)}>
                          {t("cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-start justify-between gap-2">
                      <p className="text-on-surface">{item.value}</p>
                      <div className="flex shrink-0 gap-1">
                        <button type="button" className="text-amber-200/90" onClick={() => startEdit(sIdx, iIdx)} aria-label="edit">
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button type="button" className="text-red-300/90" onClick={() => deleteItem(sIdx, iIdx)} aria-label="delete">
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {onAddMore ? (
        <div className="mt-4">
          {showAddNote ? (
            <div className="space-y-2">
              <textarea
                value={additionalNote}
                onChange={(e) => setAdditionalNote(e.target.value)}
                placeholder={t("additional_note_placeholder")}
                rows={3}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!additionalNote.trim()}
                  className="rounded-lg bg-primary/80 px-3 py-1.5 text-xs disabled:opacity-50"
                  onClick={() => {
                    onAddMore(additionalNote.trim());
                    setAdditionalNote("");
                    setShowAddNote(false);
                  }}
                >
                  {t("add_and_continue")}
                </button>
                <button type="button" className="text-xs text-on-surface-variant" onClick={() => setShowAddNote(false)}>
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="text-xs text-amber-200/90 underline" onClick={() => setShowAddNote(true)}>
              + {t("add_something")}
            </button>
          )}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        {onCancel ? (
          <button type="button" disabled={busy} className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50" onClick={onCancel}>
            {t("back_to_conversation")}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => onConfirm(edited)}
        >
          {busy ? t("confirming") : t("confirm_generate_analysis")}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-on-surface-variant/80">{t("note_about_processing")}</p>
    </div>
  );
}
