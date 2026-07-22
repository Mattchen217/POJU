"use client";

import { useCallback, useEffect, useState } from "react";

import { listArchive, type ArchiveSummary } from "@/lib/archive/archive-service";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";

export type WorkspaceProductId = "poju" | "match" | "syncro" | "glyph";

/** Recent vault rows for one product (client IndexedDB only). */
export function useWorkspaceProductHistory(product: WorkspaceProductId, limit = 8) {
  const [items, setItems] = useState<ArchiveSummary[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await listArchive({ product, limit });
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setReady(true);
    }
  }, [product, limit]);

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
