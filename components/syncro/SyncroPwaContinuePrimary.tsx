"use client";

import { useEffect, useState } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { findLatestActiveSyncroSessionForDevice } from "@/lib/syncro/syncro-session";
import { syncroSessionToSummary } from "@/lib/syncro/syncro-session-summary";
import type { SyncroSession } from "@/lib/syncro/types";

function truncateTask(text: string, max = 56): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** PWA: one-tap resume for the latest in-progress reading (IndexedDB, 24h). */
export function SyncroPwaContinuePrimary() {
  const router = useRouter();
  const t = useTranslations("syncro.recent_sessions");

  const [session, setSession] = useState<SyncroSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const latest = await findLatestActiveSyncroSessionForDevice();
        if (!cancelled) setSession(latest);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !session) return null;

  const summary = syncroSessionToSummary(session);
  const done = summary.hours_ready >= summary.hours_total;

  return (
    <div className="syncro-pwa-continue-primary mt-4">
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-xl border border-cyan-400/35 bg-cyan-950/30 px-4 py-4 text-left shadow-[0_0_24px_rgba(34,211,238,0.08)]"
        onClick={() => router.push(`/syncro/result/${session.session_id}`)}
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200/90">
            {t("pwa_continue_label")}
          </p>
          <p className="mt-1.5 text-[15px] font-medium leading-snug text-text-primary">
            &ldquo;{truncateTask(session.task_description)}&rdquo;
          </p>
          <p className="mt-1.5 text-xs text-text-dim">
            {done
              ? t("status_complete")
              : t("progress", { done: summary.hours_ready, total: summary.hours_total })}
          </p>
        </div>
        <IconChevronRight className="shrink-0 text-cyan-200/60" size={22} stroke={1.75} aria-hidden />
      </button>
    </div>
  );
}
