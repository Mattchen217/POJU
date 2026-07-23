"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";

import { listArchive, type ArchiveSummary } from "@/lib/archive/archive-service";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";
import { listActivePojuSessionsForPicker } from "@/lib/cross-product/list-active-poju-sessions-for-picker";
import { sessionListTopicLine } from "@/lib/poju/session-list-label";

export type WorkspaceProductId = "poju" | "match" | "syncro" | "glyph";

function pojuHistoryTitle(originalQuestion: string, locale: string): string {
  const snippet = sessionListTopicLine(originalQuestion);
  return locale.startsWith("zh") ? `POJU：${snippet}` : `POJU: ${snippet}`;
}

/** Recent vault rows for one product (client IndexedDB only). */
export function useWorkspaceProductHistory(product: WorkspaceProductId, limit = 8) {
  const locale = useLocale();
  const [items, setItems] = useState<ArchiveSummary[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      if (product === "poju") {
        /* Live sessions are the source of truth — vault sync is best-effort only. */
        const sessions = await listActivePojuSessionsForPicker();
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
        setItems(rows);
      }
    } catch {
      setItems([]);
    } finally {
      setReady(true);
    }
  }, [product, limit, locale]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => {
      void refresh();
    };
    window.addEventListener(ARCHIVE_UPDATED_EVENT, onUpdate);
    window.addEventListener("focus", onUpdate);
    return () => {
      window.removeEventListener(ARCHIVE_UPDATED_EVENT, onUpdate);
      window.removeEventListener("focus", onUpdate);
    };
  }, [refresh]);

  return { items, ready, refresh };
}
