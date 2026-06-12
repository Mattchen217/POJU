"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ARCHIVE_UNREAD_CHANGED_EVENT,
  getUnreadArchiveIds,
  hasUnreadArchives,
  syncArchiveUnreadState,
} from "@/lib/archive/archive-unread";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";

export function useArchiveUnread() {
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(() => {
    setHasUnread(hasUnreadArchives());
    setUnreadIds(getUnreadArchiveIds());
  }, []);

  useEffect(() => {
    void syncArchiveUnreadState().then(refresh);
    const onArchiveUpdated = () => {
      void syncArchiveUnreadState().then(refresh);
    };
    window.addEventListener(ARCHIVE_UNREAD_CHANGED_EVENT, refresh);
    window.addEventListener(ARCHIVE_UPDATED_EVENT, onArchiveUpdated);
    return () => {
      window.removeEventListener(ARCHIVE_UNREAD_CHANGED_EVENT, refresh);
      window.removeEventListener(ARCHIVE_UPDATED_EVENT, onArchiveUpdated);
    };
  }, [refresh]);

  const isUnread = useCallback((archiveId: string) => unreadIds.has(archiveId), [unreadIds]);

  return { hasUnread, isUnread, unreadIds };
}
