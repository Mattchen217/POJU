"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { findLatestActiveSyncroSessionForDevice } from "@/lib/syncro/syncro-session";
import type { SyncroSession } from "@/lib/syncro/types";

type Props = {
  onStartNew: () => void;
};

export function SyncroExistingSessionPrompt({ onStartNew }: Props) {
  const router = useRouter();
  const t = useTranslations("syncro.existing_session");

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

  const hoursLeft = Math.max(
    1,
    Math.ceil((session.expires_at.getTime() - Date.now()) / 3_600_000),
  );

  return (
    <div
      className="syncro-existing-session mt-6 rounded-xl border border-cyan-400/25 bg-cyan-950/20 px-4 py-4"
      role="region"
      aria-labelledby="syncro-existing-session-title"
    >
      <h2 id="syncro-existing-session-title" className="text-[15px] font-semibold text-cyan-100">
        {t("title")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        &ldquo;{session.task_description.trim().slice(0, 72)}
        {session.task_description.trim().length > 72 ? "…" : ""}&rdquo;
      </p>
      <p className="mt-1 text-xs text-text-dim">{t("valid_for_hours", { hours: hoursLeft })}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
        <button
          type="button"
          className="marketing-pill-outline-cta marketing-pill-outline-cta--cyan flex-1 justify-center px-4 py-2.5 text-sm font-semibold"
          onClick={() => router.push(`/syncro/result/${session.session_id}`)}
        >
          {t("continue")}
        </button>
        <button
          type="button"
          className="flex-1 rounded-lg border border-white/15 px-4 py-2.5 text-sm text-text-secondary transition hover:border-white/25 hover:text-text-primary"
          onClick={onStartNew}
        >
          {t("start_new")}
        </button>
      </div>
    </div>
  );
}
