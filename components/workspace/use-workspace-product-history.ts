"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import { listArchive, type ArchiveSummary } from "@/lib/archive/archive-service";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";
import { listActivePojuSessionsForPicker } from "@/lib/cross-product/list-active-poju-sessions-for-picker";
import { sessionListTopicLine } from "@/lib/poju/session-list-label";
import { LOCAL_OWNER_CHANGED_EVENT } from "@/lib/storage/local-owner";

export type WorkspaceProductId = "atmos" | "poju" | "match" | "syncro" | "glyph";

function pojuHistoryTitle(originalQuestion: string, locale: string): string {
  const snippet = sessionListTopicLine(originalQuestion);
  return locale.startsWith("zh") ? `POJU：${snippet}` : `POJU: ${snippet}`;
}

function rowMatchesHistoryId(row: ArchiveSummary, id: string): boolean {
  return row.archive_id === id || row.session_id === id;
}

/** Recent vault rows for one product (client IndexedDB only). */
export function useWorkspaceProductHistory(product: WorkspaceProductId, limit = 8) {
  const locale = useLocale();
  const [items, setItems] = useState<ArchiveSummary[]>([]);
  const [ready, setReady] = useState(false);
  /** Drop stale async list results (e.g. confirm-dialog focus racing a delete). */
  const refreshGenRef = useRef(0);

  const refresh = useCallback(async () => {
    const gen = ++refreshGenRef.current;
    try {
      if (product === "poju") {
        /* Live sessions are the source of truth — vault sync is best-effort only. */
        const sessions = await listActivePojuSessionsForPicker();
        if (gen !== refreshGenRef.current) return;
        const rows: ArchiveSummary[] = sessions.slice(0, limit).map((s) => ({
          archive_id: s.session_id,
          type: "poju_session",
          title: pojuHistoryTitle(s.original_question, locale),
          product: "poju",
          session_id: s.session_id,
          created_at: s.last_interaction_at,
        }));
        setItems(rows);
      } else {
        const rows = await listArchive({ product, limit });
        if (gen !== refreshGenRef.current) return;
        setItems(rows);
      }
    } catch {
      if (gen !== refreshGenRef.current) return;
      setItems([]);
    } finally {
      if (gen === refreshGenRef.current) setReady(true);
    }
  }, [product, limit, locale]);

  /** Instant sidebar update — do not wait for IndexedDB re-list. */
  const removeLocal = useCallback((id: string) => {
    refreshGenRef.current += 1;
    setItems((prev) => prev.filter((row) => !rowMatchesHistoryId(row, id)));
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => {
      void refresh();
    };
    window.addEventListener(ARCHIVE_UPDATED_EVENT, onUpdate);
    window.addEventListener(LOCAL_OWNER_CHANGED_EVENT, onUpdate);
    // Do not refresh on window `focus`: closing the delete confirm restores
    // focus and can finish a pre-delete list read after a successful delete,
    // painting the removed row back until a hard reload.
    return () => {
      window.removeEventListener(ARCHIVE_UPDATED_EVENT, onUpdate);
      window.removeEventListener(LOCAL_OWNER_CHANGED_EVENT, onUpdate);
    };
  }, [refresh]);

  return { items, ready, refresh, removeLocal };
}
