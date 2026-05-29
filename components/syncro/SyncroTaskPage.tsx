"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { PojuToolHandoffBanner } from "@/components/poju/PojuToolHandoffBanner";
import { SyncroExistingSessionPrompt } from "@/components/syncro/SyncroExistingSessionPrompt";
import { usePojuToolHandoff } from "@/lib/poju/use-poju-tool-handoff";
import {
  cleanupExpiredSyncroSessions,
  findLatestActiveSyncroSessionForDevice,
} from "@/lib/syncro/syncro-session";
import { inferTaskTimeScope, SYNCRO_TASK_TIME_KEY } from "@/lib/syncro/syncro-view-helpers";
import type { SyncroSession } from "@/lib/syncro/types";
import "@/styles/poju-tool-handoff.css";

const MIN_LEN = 6;
const MAX_LEN = 100;

type EntryPhase = "checking" | "prompt" | "form";

export function SyncroTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("syncro.task");
  const tRoot = useTranslations("syncro");

  const pojuHandoff = usePojuToolHandoff("syncro");
  const sessionType =
    pojuHandoff?.quota_free || searchParams.get("type") === "free" ? "free" : "paid";

  const [entryPhase, setEntryPhase] = useState<EntryPhase>("checking");
  const [activeSession, setActiveSession] = useState<SyncroSession | null>(null);
  const [task, setTask] = useState("");
  const [showMinWarning, setShowMinWarning] = useState(false);

  const trimmedLen = task.trim().length;
  const canContinue = trimmedLen >= MIN_LEN;
  const charsRemaining = Math.max(0, MIN_LEN - trimmedLen);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEntryPhase("form");
      return;
    }

    let cancelled = false;

    void (async () => {
      await cleanupExpiredSyncroSessions();
      const session = await findLatestActiveSyncroSessionForDevice();
      if (cancelled) return;

      if (session) {
        setActiveSession(session);
        setEntryPhase("prompt");
      } else {
        setEntryPhase("form");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (canContinue) setShowMinWarning(false);
  }, [canContinue]);

  useEffect(() => {
    const prefill =
      pojuHandoff?.prefill.task_description ?? searchParams.get("task_description");
    if (prefill && !task) setTask(prefill);
  }, [pojuHandoff, searchParams, task]);

  function handleContinue() {
    if (!canContinue) {
      setShowMinWarning(true);
      return;
    }

    const trimmed = task.trim();
    sessionStorage.setItem("syncro_task_pending", trimmed);
    sessionStorage.setItem("syncro_session_type", sessionType);
    sessionStorage.setItem(SYNCRO_TASK_TIME_KEY, inferTaskTimeScope(trimmed));
    router.push("/syncro/prepare");
  }

  if (entryPhase === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-deep text-text-secondary">
        <p>{tRoot("loading")}</p>
      </main>
    );
  }

  if (entryPhase === "prompt" && activeSession) {
    return (
      <SyncroExistingSessionPrompt
        session={activeSession}
        onStartNew={() => {
          setActiveSession(null);
          setEntryPhase("form");
        }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-bg-deep text-text-body">
      <div className="syncro-task-page mx-auto w-full max-w-lg px-4 pb-12 pt-6">
        <Link
          href="/syncro"
          className="inline-flex text-sm text-cyan-200/80 hover:text-cyan-100"
        >
          ← {t("back")}
        </Link>

        {pojuHandoff ? <PojuToolHandoffBanner handoff={pojuHandoff} className="mt-6" /> : null}

        <div className="task-content mt-8">
          <h1 className="text-2xl font-semibold text-text-primary">{t("title")}</h1>
          <p className="mt-3 text-[15px] leading-8 text-text-secondary">{t("subtitle")}</p>

          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value.slice(0, MAX_LEN))}
            placeholder={t("placeholder")}
            rows={6}
            autoFocus
            className="mt-6 w-full resize-none rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-[15px] leading-7 text-text-primary placeholder:text-text-dim focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          />

          <div
            className={`char-count mt-2 text-sm text-text-dim ${showMinWarning && !canContinue ? "syncro-task-char-count--warn" : ""}`}
            role="status"
            aria-live="polite"
          >
            {task.length} / {MAX_LEN}
            {trimmedLen < MIN_LEN ? (
              <span className="hint text-amber-200/80"> · {t("min_chars", { min: MIN_LEN })}</span>
            ) : null}
          </div>
          {showMinWarning && !canContinue ? (
            <p className="mt-2 text-sm font-medium text-amber-200">
              {t("min_chars_remaining", { remaining: charsRemaining })}
            </p>
          ) : null}

          <div className="examples mt-8">
            <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-dim">
              {t("examples_title")}
            </h4>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-text-secondary">
              <li>· {t("example_1")}</li>
              <li>· {t("example_2")}</li>
              <li>· {t("example_3")}</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleContinue}
            aria-disabled={!canContinue}
            className={`marketing-pill-outline-cta marketing-pill-outline-cta--cyan mt-10 inline-flex w-full justify-center px-8 py-3.5 text-[15px] font-semibold touch-manipulation [-webkit-tap-highlight-color:transparent] hover:-translate-y-0.5 hover:scale-[1.02] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 active:scale-[0.99] ${!canContinue ? "syncro-task-continue--inactive" : ""} ${showMinWarning && !canContinue ? "syncro-task-continue--pulse" : ""}`}
          >
            {t("continue")}
          </button>
        </div>
      </div>
    </main>
  );
}
