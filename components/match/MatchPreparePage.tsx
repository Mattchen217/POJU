"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Layer1PrepareWork } from "@/components/poju/Layer1PrepareWork";
import { PreparingSplineShell } from "@/components/poju/PreparingSplineShell";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { useRouter } from "@/i18n/navigation";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { clearPendingBaseAnalysisProfile } from "@/lib/profile/pending-base-analysis";
import {
  discardIncompletePendingProfile,
  getStoredProfile,
  getStoredProfileRecord,
  profileHasBaseAnalysis,
} from "@/lib/profile/stored-profiles-service";
import {
  PREPARING_MIN_SPLINE_CACHE_MS,
  waitRemainingMinSpline,
} from "@/lib/poju/preparing-spline-timing";
import { ensureProfileMatrixList } from "@/lib/poju/resolve-matrix-preview";

import "@/styles/match.css";

type Phase = "loading" | "cache" | "streaming" | "error";

type MatchPreparePageProps = {
  profileId: string;
};

export function MatchPreparePage({ profileId }: MatchPreparePageProps) {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const tPrep = useTranslations("session_prep");
  const tMatch = useTranslations("match");
  const tChart = useTranslations("chart_loader");

  const next = searchParams.get("next");
  const partnerId = searchParams.get("partner")?.trim() ?? "";

  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const cacheSplineStartedRef = useRef(0);
  const initRef = useRef(false);

  const finishToMatch = useCallback(() => {
    clearPendingBaseAnalysisProfile();
    if (next === "match" && partnerId) {
      router.push("/match/analyzing");
      return;
    }
    router.push("/match");
  }, [next, partnerId, router]);

  useEffect(() => {
    if (!profileId || initRef.current) return;
    initRef.current = true;

    void (async () => {
      const profileData = await getStoredProfile(profileId);
      if (!profileData) {
        router.replace("/match/select-a");
        return;
      }
      setProfile(profileData);

      const record = await getStoredProfileRecord(profileId);
      const hasCache =
        Boolean(record?.has_base_analysis) ||
        (profileData.base_analysis?.content !== undefined &&
          profileData.base_analysis?.content !== null);

      if (hasCache) {
        cacheSplineStartedRef.current = Date.now();
        setPhase("cache");
        return;
      }

      setPhase("streaming");
    })();
  }, [profileId, router]);

  useEffect(() => {
    if (phase !== "cache") return;
    void (async () => {
      await waitRemainingMinSpline(cacheSplineStartedRef.current, PREPARING_MIN_SPLINE_CACHE_MS);
      finishToMatch();
    })();
  }, [phase, finishToMatch]);

  async function handleStreamError(err: string) {
    if (await profileHasBaseAnalysis(profileId)) {
      finishToMatch();
      return;
    }
    await discardIncompletePendingProfile(profileId);
    setError(err);
    setPhase("error");
  }

  if (!profile || phase === "loading") {
    return (
      <main className="match-prepare-page">
        <PreparingStatusOverlay>
          <p className="preparing-spline-page__status">{tPrep("preparing")}</p>
        </PreparingStatusOverlay>
      </main>
    );
  }

  if (phase === "cache") {
    return (
      <main className="match-prepare-page">
        <PreparingSplineShell blockInteraction>
          <PreparingStatusOverlay>
            <p className="preparing-spline-page__status">{tPrep("preparing_done")}</p>
          </PreparingStatusOverlay>
        </PreparingSplineShell>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="match-prepare-page match-prepare-page--error">
        <p>{error}</p>
        <button type="button" className="match-primary-btn" onClick={() => setPhase("streaming")}>
          {tChart("retry")}
        </button>
        <button type="button" className="match-relationship-back" onClick={() => router.push("/match/relationship")}>
          {tMatch("relationship.back")}
        </button>
      </main>
    );
  }

  return (
    <main className="match-prepare-page">
      <PreparingSplineShell blockInteraction>
        <Layer1PrepareWork
          profileId={profileId}
          locale={locale}
          preWork={async () => {
            await ensureProfileMatrixList({
              profileId,
              userProfile: profile.user_profile,
              locale,
            });
          }}
          onComplete={finishToMatch}
          onError={handleStreamError}
        />
      </PreparingSplineShell>
    </main>
  );
}
