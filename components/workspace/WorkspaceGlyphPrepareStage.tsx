"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import { CachedProfilePrepareWait } from "@/components/wait-ritual/CachedProfilePrepareWait";
import { finalizeToolPreview } from "@/lib/cross-product/finalize-tool-preview";
import { getCachedBaseAnalysis } from "@/lib/cross-product/get-cached-base-analysis";
import { saveGlyphToolPreviewSession } from "@/lib/cross-product/tool-preview-session-cache";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

type Props = {
  profileId: string;
  /** Called when 10s wait + preview work finish (or immediately if no BA cache). */
  onComplete: () => void;
  onBack: () => void;
};

/**
 * Workspace Glyph prepare: same ritual as GlyphPrepareProfilePage,
 * but stays in /app center via callbacks (no route navigation).
 */
export function WorkspaceGlyphPrepareStage({ profileId, onComplete, onBack }: Props) {
  const locale = useLocale();
  const [needsWait, setNeedsWait] = useState<boolean | null>(null);
  const initRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!profileId || initRef.current) return;
    initRef.current = true;

    void (async () => {
      const cached = await getCachedBaseAnalysis(profileId);
      if (!cached) {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete();
        }
        return;
      }
      setNeedsWait(true);
    })();
  }, [profileId, onComplete]);

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

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  if (needsWait !== true) {
    return null;
  }

  return (
    <CachedProfilePrepareWait
      product="glyph"
      prepareWork={prepareWork}
      onComplete={handleComplete}
      onBack={onBack}
    />
  );
}
