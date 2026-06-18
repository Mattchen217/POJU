"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PojuToolHandoffBanner } from "@/components/poju/PojuToolHandoffBanner";
import { SessionPreparation } from "@/components/poju/SessionPreparation";
import { usePojuToolHandoff } from "@/lib/poju/use-poju-tool-handoff";
import "@/styles/poju-tool-handoff.css";
import {
  listStoredProfilesForSessionPrep,
  type StoredProfileSummary,
} from "@/lib/profile/stored-profiles-service";
import "@/styles/session-prep.css";

function GlyphPrepareInner() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("glyph");

  const pojuHandoff = usePojuToolHandoff("glyph");

  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const list = await listStoredProfilesForSessionPrep();
        setProfiles(list);
      } catch (e) {
        console.error("[glyph/prepare]", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleProfileSelected(profileId: string) {
    router.push(`/glyph/preparing/${encodeURIComponent(profileId)}`);
  }

  function handleBack() {
    router.push("/glyph");
  }

  if (loading) {
    return <div className="session-prep-loading">{t("loading")}</div>;
  }

  return (
    <div className="browser-flow-page">
      {pojuHandoff ? (
        <div className="mx-auto w-full max-w-lg px-4 pt-6">
          <PojuToolHandoffBanner handoff={pojuHandoff} />
        </div>
      ) : null}
      <SessionPreparation
        sessionId="glyph"
        existingProfiles={profiles}
        onProfileSelected={handleProfileSelected}
        onRefund={handleBack}
        locale={locale}
        productType="glyph"
      />
    </div>
  );
}

export default function GlyphPreparePage() {
  return (
    <Suspense fallback={<div className="session-prep-loading">…</div>}>
      <GlyphPrepareInner />
    </Suspense>
  );
}
