"use client";

import { useEffect, useRef, useState } from "react";

import { CachedProfileBaziWait } from "@/components/wait-ritual/CachedProfileBaziWait";
import { useRouter } from "@/i18n/navigation";
import { getCachedBaseAnalysis } from "@/lib/cross-product/get-cached-base-analysis";

type Phase = "loading" | "bazi";

type Props = {
  profileId: string;
};

/** Existing cached profile — 10s bazi ritual before draw/question; new profiles skip straight to draw. */
export function GlyphPrepareProfilePage({ profileId }: Props) {
  const router = useRouter();
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
      setPhase("bazi");
    })();
  }, [profileId, router]);

  if (phase === "bazi") {
    return (
      <CachedProfileBaziWait
        product="glyph"
        onComplete={() => router.push(`/glyph/draw?profile=${encodeURIComponent(profileId)}`)}
      />
    );
  }

  return null;
}
