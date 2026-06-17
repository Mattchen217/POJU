"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { PojuEnergyMatrix } from "@/components/poju/PojuEnergyMatrix";
import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";
import { ToolMatrixNarrativeReply } from "@/components/cross-product/ToolMatrixNarrativeReply";
import { finalizeToolPreview } from "@/lib/cross-product/finalize-tool-preview";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { MatrixNarrativeResponse } from "@/lib/llm/prompts/matrix-narrative-prompt";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import {
  ensureSyncroPreviewSession,
  patchSyncroPreviewSession,
} from "@/lib/syncro/syncro-preview-session";

export function SyncroPreviewPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("syncro");
  const tTask = useTranslations("syncro.task");

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [task, setTask] = useState("");
  const [matrixPayload, setMatrixPayload] = useState<PojuMatrixPayload | null>(null);
  const [narrative, setNarrative] = useState<MatrixNarrativeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const initRef = useRef(false);

  const loadPreview = useCallback(async () => {
    const profileId = sessionStorage.getItem("syncro_profile_id");
    const pendingTask = sessionStorage.getItem("syncro_task_pending");

    if (!profileId || !pendingTask) {
      router.replace("/syncro/task");
      return;
    }

    previewAbortRef.current?.abort();
    const ac = new AbortController();
    previewAbortRef.current = ac;

    setLoading(true);
    setError(null);
    setTask(pendingTask);

    try {
      const row = await getStoredProfile(profileId);
      if (!row?.user_profile) {
        router.replace("/syncro/prepare");
        return;
      }
      setProfile(row);

      ensureSyncroPreviewSession({ profile_id: profileId, locale });

      const preview = await finalizeToolPreview({
        profileId,
        userProfile: row.user_profile,
        locale,
        product: "syncro",
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;

      setMatrixPayload(preview.matrix_payload);
      setNarrative(preview.narrative);
      patchSyncroPreviewSession({ matrix_payload: preview.matrix_payload });
    } catch (e) {
      if (ac.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [locale, router]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void loadPreview();
    return () => previewAbortRef.current?.abort();
  }, [loadPreview]);

  function handleContinue() {
    router.push("/syncro/location");
  }

  if (loading) {
    return (
      <PreparingSplineShell blockInteraction>
        <div className="preparing-spline-page__overlay" role="status" aria-live="polite">
          <p className="preparing-spline-page__status">{t("loading")}</p>
        </div>
      </PreparingSplineShell>
    );
  }

  return (
    <main className="min-h-screen bg-bg-deep text-text-body">
      <div className="syncro-preview-page browser-flow-page mx-auto w-full max-w-lg px-4 pb-12 pt-6">
        <Link href="/syncro/prepare" className="inline-flex text-sm text-cyan-200/80 hover:text-cyan-100">
          ← {tTask("back")}
        </Link>

        {matrixPayload ? (
          <div className="syncro-preview-block pchat mt-6">
            <PojuEnergyMatrix payload={matrixPayload} locale={locale} compact />
            <div className="syncro-preview-narrative pchat__bubble pchat__bubble--assistant mt-4">
              <ToolMatrixNarrativeReply
                product="syncro"
                locale={locale}
                payloadA={matrixPayload}
                narrative={narrative}
              />
            </div>
          </div>
        ) : null}

        {task ? (
          <div className="syncro-preview-task mt-6 rounded-xl border border-white/10 bg-black/25 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-dim">{tTask("title")}</p>
            <p className="mt-2 text-[15px] leading-7 text-text-secondary">&ldquo;{task}&rdquo;</p>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-300/90">{error}</p> : null}

        <button
          type="button"
          onClick={handleContinue}
          className="marketing-pill-outline-cta marketing-pill-outline-cta--cyan mt-10 inline-flex w-full justify-center px-8 py-3.5 text-[15px] font-semibold"
        >
          {tTask("continue")}
        </button>
      </div>
    </main>
  );
}
