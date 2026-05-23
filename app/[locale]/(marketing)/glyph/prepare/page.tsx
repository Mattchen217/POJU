"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { SessionPreparation } from "@/components/poju/SessionPreparation";
import { listStoredProfiles, type StoredProfileSummary } from "@/lib/profile/stored-profiles-service";
import "@/styles/session-prep.css";

function GlyphPrepareInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("glyph");

  const sessionType = searchParams.get("type") === "paid" ? "paid" : "free";

  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const list = await listStoredProfiles();
        setProfiles(list);
      } catch (e) {
        console.error("[glyph/prepare]", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleProfileSelected(profileId: string) {
    router.push(`/glyph/draw?profile=${encodeURIComponent(profileId)}&type=${sessionType}`);
  }

  function handleBack() {
    router.push("/glyph");
  }

  if (loading) {
    return <div className="session-prep-loading">{t("loading")}</div>;
  }

  return (
    <SessionPreparation
      sessionId="glyph"
      existingProfiles={profiles}
      onProfileSelected={handleProfileSelected}
      onRefund={handleBack}
      locale={locale}
      productType="glyph"
    />
  );
}

export default function GlyphPreparePage() {
  return (
    <Suspense fallback={<div className="session-prep-loading">…</div>}>
      <GlyphPrepareInner />
    </Suspense>
  );
}
