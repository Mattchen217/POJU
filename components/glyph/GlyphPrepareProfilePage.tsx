"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import { CachedProfilePrepareWait } from "@/components/wait-ritual/CachedProfilePrepareWait";
import { useRouter } from "@/i18n/navigation";
import { finalizeToolPreview } from "@/lib/cross-product/finalize-tool-preview";
import { getCachedBaseAnalysis } from "@/lib/cross-product/get-cached-base-analysis";
import { saveGlyphToolPreviewSession } from "@/lib/cross-product/tool-preview-session-cache";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

type Phase = "loading" | "wait";

type Props = {
  profileId: string;
};

/** Cached profile — bazi ritual + matrix-narrative LLM together, min 10s, then draw. */
export function GlyphPrepareProfilePage({ profileId }: Props) {
  const router = useRouter();
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>("loading");
  const initRef = useRef(false);

  useEffect(() => {
    if (!profileId || initRef.current) return;
    initRef.current = true;

    void (async () => {
      const cached = await getCachedBaseAnalysis(profileId);
      if (!cached) {
        router.replace(`/glyph/draw?profile=${encodeURIComponent(profileId)}`);
        return;
      }
      setPhase("wait");
    })();
  }, [profileId, router]);

  const prepareWork = useCallback(async () => {
    const row = await getStoredProfile(profileId);
    if (!row?.user_profile) {
      throw new Error("Profile not found");
    }

    const preview = await finalizeToolPreview({
      profileId,
      userProfile: row.user_profile,
      locale,
      product: "glyph",
    });

    saveGlyphToolPreviewSession(profileId, preview);
  }, [profileId, locale]);

  if (phase === "wait") {
    return (
      <CachedProfilePrepareWait
        product="glyph"
        prepareWork={prepareWork}
        onComplete={() => router.push(`/glyph/draw?profile=${encodeURIComponent(profileId)}`)}
        onBack={() => router.push("/glyph/prepare")}
      />
    );
  }

  return null;
}
