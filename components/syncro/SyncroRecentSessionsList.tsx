"use client";

import { useEffect, useState } from "react";
import { IconChevronRight, IconClock } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import {
  listActiveSyncroSessionSummariesForDevice,
  type SyncroSessionSummary,
} from "@/lib/syncro/syncro-session-summary";

function formatExpiresIn(locale: string, expiresAt: Date): string {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return "";
  const hours = Math.ceil(ms / 3_600_000);
  if (hours < 2) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      Math.ceil(ms / 60_000),
      "minute",
    );
  }
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(hours, "hour");
}

function truncateTask(text: string, max = 72): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function SyncroRecentSessionsList() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("syncro.recent_sessions");

  const [items, setItems] = useState<SyncroSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const list = await listActiveSyncroSessionSummariesForDevice();
        if (!cancelled) setItems(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const onFocus = () => {
      void listActiveSyncroSessionSummariesForDevice().then((list) => {
        if (!cancelled) setItems(list);
      });
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (loading) {
    return (
      <div className="syncro-recent-sessions mt-8 text-center text-sm text-text-dim">
        {t("loading")}
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="syncro-recent-sessions mt-10 w-full text-left" aria-labelledby="syncro-recent-heading">
      <h2 id="syncro-recent-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
        {t("heading")}
      </h2>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{t("hint")}</p>

      <ul className="mt-4 space-y-3">
        {items.map((item) => {
          const done = item.hours_ready >= item.hours_total;
          const progressLabel = t("progress", {
            done: item.hours_ready,
            total: item.hours_total,
          });

          return (
            <li key={item.session_id}>
              <button
                type="button"
                className="syncro-recent-session-card flex w-full items-start gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-cyan-400/25 hover:bg-black/35"
                onClick={() => router.push(`/syncro/result/${item.session_id}`)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium leading-snug text-text-primary">
                    &ldquo;{truncateTask(item.task_description)}&rdquo;
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-dim">
                    <span className={done ? "text-cyan-200/90" : "text-amber-200/80"}>
                      {done ? t("status_complete") : progressLabel}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconClock size={14} stroke={1.75} aria-hidden />
                      {t("expires", { when: formatExpiresIn(locale, item.expires_at) })}
                    </span>
                  </div>
                </div>
                <IconChevronRight
                  className="mt-0.5 shrink-0 text-cyan-200/50"
                  size={20}
                  stroke={1.75}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
