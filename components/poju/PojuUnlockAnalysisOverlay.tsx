"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { BaseAnalysisStreamPreparing } from "@/components/poju/BaseAnalysisStreamPreparing";
import { PreparingStatusOverlay } from "@/components/poju/PreparingStatusOverlay";
import { usePreparingBlockInput } from "@/components/poju/preparing-spline-control";
import { formatBaseAnalysisForDisplay } from "@/lib/profile/format-base-analysis-zh";
import type { StoredProfileData } from "@/lib/db/poju-db";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

const REPLAY_MIN_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type PojuUnlockAnalysisOverlayProps = {
  profileId: string;
  locale: string;
  mode: "replay" | "live";
  onComplete: (reportText: string) => void | Promise<void>;
  onError?: (error: string) => void;
};

export function PojuUnlockAnalysisOverlay({
  profileId,
  locale,
  mode,
  onComplete,
  onError,
}: PojuUnlockAnalysisOverlayProps) {
  const tPrep = useTranslations("session_prep");
  const [profile, setProfile] = useState<StoredProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const replayStartedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const row = await getStoredProfile(profileId);
        if (!row) throw new Error("Profile not found");
        if (!cancelled) {
          setProfile(row);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          onError?.(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, onError]);

  const finishReplay = useCallback(async () => {
    const row = await getStoredProfile(profileId);
    const ba = row?.base_analysis;
    if (!ba) {
      onError?.("Cached report missing");
      return;
    }
    const text = formatBaseAnalysisForDisplay({
      content: ba.content,
      display_text: ba.display_text,
      raw_text: ba.raw_text,
    });
    await onComplete(text);
  }, [profileId, onComplete, onError]);

  usePreparingBlockInput(true);

  if (loading || !profile) {
    return (
      <PreparingStatusOverlay>
        <p className="preparing-spline-page__status">{tPrep("preparing")}</p>
      </PreparingStatusOverlay>
    );
  }

  if (mode === "replay") {
    return <ReplayPhase onDone={() => void finishReplay()} label={tPrep("preparing_done")} />;
  }

  return (
    <BaseAnalysisStreamPreparing
      profile={profile}
      profileId={profileId}
      locale={locale}
      logLabel="POJUUnlock"
      mode="live"
      onComplete={async (displayText) => {
        await onComplete(displayText);
      }}
      onError={onError}
    />
  );
}

function ReplayPhase({ onDone, label }: { onDone: () => void; label: string }) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      await sleep(REPLAY_MIN_MS);
      onDone();
    })();
  }, [onDone]);

  return (
    <PreparingStatusOverlay>
      <p className="preparing-spline-page__status">{label}</p>
    </PreparingStatusOverlay>
  );
}
