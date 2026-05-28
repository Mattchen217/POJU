"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { SyncroGuardedRoute } from "@/components/syncro/SyncroGuardedRoute";
import { SyncroLlmBatchRunner, type SyncroLlmProgress } from "@/components/syncro/SyncroLlmBatchRunner";
import { SyncroLlmProgressBar } from "@/components/syncro/SyncroLlmProgressBar";
import { PojuDeepDiveCTA } from "@/components/cross-product/PojuDeepDiveCTA";
import { ReturnToPojuCTA } from "@/components/poju/ReturnToPojuCTA";
import { SyncroMainView } from "@/components/syncro/SyncroMainView";
import { extractSyncroSummary } from "@/lib/poju/tool-result-summary";
import { SyncroOrientationProvider } from "@/components/syncro/SyncroOrientationProvider";
import { Link } from "@/i18n/navigation";
import { isSyncroSessionExpired, loadSyncroSession } from "@/lib/syncro/syncro-session";
import type { SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro.css";

type Stage = "loading" | "ready" | "expired" | "error";

function SyncroResultPageContent() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations("syncro.expired");
  const tError = useTranslations("syncro.main");

  const sessionId = params.id as string;

  const [session, setSession] = useState<SyncroSession | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [llmProgress, setLlmProgress] = useState<SyncroLlmProgress>({
    completed: 0,
    total: 6,
    running: true,
    failed: 0,
  });
  const [highlightKeys, setHighlightKeys] = useState<Set<string>>(() => new Set());

  const handleSessionUpdate = useCallback((next: SyncroSession) => {
    setSession(next);
  }, []);

  useEffect(() => {
    void loadSession();
  }, [sessionId]);

  useEffect(() => {
    function onPatch(ev: Event) {
      const detail = (ev as CustomEvent<{ session_id: string; updated_keys: string[] }>).detail;
      if (detail?.session_id !== sessionId) return;
      setHighlightKeys((prev) => {
        const next = new Set(prev);
        for (const k of detail.updated_keys) next.add(k);
        return next;
      });
      window.setTimeout(() => {
        setHighlightKeys((prev) => {
          const next = new Set(prev);
          for (const k of detail.updated_keys) next.delete(k);
          return next;
        });
      }, 2400);
    }
    window.addEventListener("syncro-matrix-patch", onPatch);
    return () => window.removeEventListener("syncro-matrix-patch", onPatch);
  }, [sessionId]);

  async function loadSession() {
    try {
      const expired = await isSyncroSessionExpired(sessionId);
      if (expired) {
        setStage("expired");
        return;
      }

      const s = await loadSyncroSession(sessionId);
      if (!s) {
        setStage("error");
        return;
      }

      setSession(s);
      setStage("ready");
    } catch {
      setStage("error");
    }
  }

  if (stage === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-deep text-text-dim">
        …
      </div>
    );
  }

  if (stage === "expired") {
    return (
      <div className="syncro-expired">
        <h2>{t("title")}</h2>
        <p>{t("message")}</p>
        <Link href="/syncro" className="primary">
          {t("cta")}
        </Link>
      </div>
    );
  }

  if (stage === "error" || !session) {
    return (
      <div className="syncro-error flex min-h-screen flex-col items-center justify-center bg-bg-deep px-4 text-center">
        <p className="text-text-secondary">{tError("session_not_found")}</p>
        <Link href="/syncro" className="mt-6 text-cyan-200 underline">
          {t("cta")}
        </Link>
      </div>
    );
  }

  const syncroSummary = extractSyncroSummary(session);

  return (
    <SyncroOrientationProvider>
      <div className="px-4 pt-4">
        <ReturnToPojuCTA
          tool="syncro"
          resultId={sessionId}
          resultData={syncroSummary}
          variant="banner"
        />
      </div>
      <SyncroLlmProgressBar progress={llmProgress} />
      <SyncroLlmBatchRunner
        sessionId={sessionId}
        onSessionUpdate={handleSessionUpdate}
        onProgress={setLlmProgress}
      />
      <SyncroMainView
        session={session}
        locale={locale}
        highlightMatrixKeys={highlightKeys}
        llmProgress={llmProgress}
      />
      <div className="px-4 pb-8">
        <PojuDeepDiveCTA productId="syncro" result_id={sessionId} result_data={syncroSummary} />
        <ReturnToPojuCTA
          tool="syncro"
          resultId={sessionId}
          resultData={syncroSummary}
          variant="footer"
        />
      </div>
    </SyncroOrientationProvider>
  );
}

export default function SyncroResultPage() {
  return (
    <SyncroGuardedRoute>
      <SyncroResultPageContent />
    </SyncroGuardedRoute>
  );
}
