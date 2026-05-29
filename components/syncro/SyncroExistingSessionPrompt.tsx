"use client";

import { IconClock } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import type { SyncroSession } from "@/lib/syncro/types";

export type SyncroExistingSessionPromptProps = {
  session: SyncroSession;
  onStartNew: () => void;
};

export function SyncroExistingSessionPrompt({
  session,
  onStartNew,
}: SyncroExistingSessionPromptProps) {
  const router = useRouter();
  const t = useTranslations("syncro.existing_session");

  const remainingMs = session.expires_at.getTime() - Date.now();
  const remainingHours = Math.max(1, Math.ceil(remainingMs / 3_600_000));

  function handleContinue() {
    sessionStorage.setItem("syncro_profile_id", session.profile_id);
    router.push(`/syncro/result/${session.session_id}`);
  }

  return (
    <main className="syncro-existing-session-prompt min-h-screen bg-bg-deep px-4 py-12 text-text-body">
      <div className="mx-auto w-full max-w-md text-center">
        <div className="logo-mark" aria-hidden>
          ◇
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-text-primary">{t("title")}</h1>

        <p className="task-preview mt-4 text-[15px] leading-7 text-text-secondary">
          &ldquo;{session.task_description}&rdquo;
        </p>

        <div className="session-meta mt-5 inline-flex items-center gap-2 text-sm text-text-dim">
          <IconClock size={16} stroke={1.75} aria-hidden />
          <span>{t("valid_for_hours", { hours: remainingHours })}</span>
        </div>

        <button
          type="button"
          className="continue-btn marketing-pill-outline-cta marketing-pill-outline-cta--cyan mt-10 w-full px-8 py-3.5 text-[15px] font-semibold"
          onClick={handleContinue}
        >
          {t("continue")}
        </button>

        <button type="button" className="new-task-btn mt-4 text-sm text-cyan-200/90 underline underline-offset-4" onClick={onStartNew}>
          {t("start_new")}
        </button>
      </div>
    </main>
  );
}
