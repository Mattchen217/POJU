"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import {
  ARCHIVE_UNREAD_CHANGED_EVENT,
  getUnreadArchiveIds,
  hasUnreadArchives,
  syncArchiveUnreadState,
} from "@/lib/archive/archive-unread";
import { reconcilePendingDeliveryArchives } from "@/lib/archive/archive-delivery-pending";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";

export function useArchiveUnread() {
  const pathname = usePathname();
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(() => {
    setHasUnread(hasUnreadArchives());
    setUnreadIds(getUnreadArchiveIds());
  }, []);

  useEffect(() => {
    reconcilePendingDeliveryArchives(pathname);
    void syncArchiveUnreadState().then(refresh);
  }, [pathname, refresh]);

  useEffect(() => {
    const onArchiveUpdated = () => {
      reconcilePendingDeliveryArchives(pathname);
      void syncArchiveUnreadState().then(refresh);
    };

    window.addEventListener(ARCHIVE_UNREAD_CHANGED_EVENT, refresh);
    window.addEventListener(ARCHIVE_UPDATED_EVENT, onArchiveUpdated);
    return () => {
      window.removeEventListener(ARCHIVE_UNREAD_CHANGED_EVENT, refresh);
      window.removeEventListener(ARCHIVE_UPDATED_EVENT, onArchiveUpdated);
    };
  }, [pathname, refresh]);

  const isUnread = useCallback((archiveId: string) => unreadIds.has(archiveId), [unreadIds]);

  return { hasUnread, isUnread, unreadIds };
}
