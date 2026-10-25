"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import { CachedProfilePrepareWait } from "@/components/wait-ritual/CachedProfilePrepareWait";
import { useRouter } from "@/i18n/navigation";
import { finalizeToolPreview } from "@/lib/cross-product/finalize-tool-preview";
import { saveMatchToolPreviewSession } from "@/lib/cross-product/tool-preview-session-cache";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

/** Both profiles cached — bazi ritual + matrix-narrative LLM, min 10s, then relationship. */
export function MatchCachedPrepPage() {
  const router = useRouter();
  const locale = useLocale();
  const [ready, setReady] = useState(false);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const storedA = sessionStorage.getItem("match_a_profile_id");
    const storedB = sessionStorage.getItem("match_b_profile_id");
    if (!storedA || !storedB) {
      router.replace("/match/select-a");
      return;
    }
    setAId(storedA);
    setBId(storedB);
    setReady(true);
  }, [router]);

  const prepareWork = useCallback(async () => {
    const [aRow, bRow] = await Promise.all([getStoredProfile(aId), getStoredProfile(bId)]);
    if (!aRow?.user_profile || !bRow?.user_profile) {
      throw new Error("Profile not found");
    }

    const preview = await finalizeToolPreview({
      profileId: aId,
      userProfile: aRow.user_profile,
      profileBId: bId,
      userProfileB: bRow.user_profile,
      locale,
      product: "match",
    });

    saveMatchToolPreviewSession(aId, bId, preview);
  }, [aId, bId, locale]);

  if (!ready) return null;

  return (
    <CachedProfilePrepareWait
      product="match"
      prepareWork={prepareWork}
      onComplete={() => router.push("/match/relationship")}
      onBack={() => router.push("/match/select-b")}
    />
  );
}
