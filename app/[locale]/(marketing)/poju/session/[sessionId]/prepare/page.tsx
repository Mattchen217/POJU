"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { SessionPreparation } from "@/components/poju/SessionPreparation";
import { loadPOJUSession } from "@/lib/poju/session-manager";
import { listStoredProfiles, type StoredProfileSummary } from "@/lib/profile/stored-profiles-service";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import type { POJUSessionState } from "@/lib/poju/types";
import "@/styles/session-prep.css";

export default function PreparePage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("session_prep");

  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";

  const [session, setSession] = useState<POJUSessionState | null>(null);
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    void (async () => {
      try {
        const sessionData = await loadPOJUSession(sessionId);
        if (!sessionData) {
          router.replace("/poju");
          return;
        }

        if (resolveSessionHasProfile(sessionData) && sessionData.selected_stored_profile_id) {
          router.replace(
            `/poju/session/${sessionId}/preparing?profile=${encodeURIComponent(sessionData.selected_stored_profile_id)}`,
          );
          return;
        }

        const profileList = await listStoredProfiles();
        if (cancelled) return;
        setSession(sessionData);
        setProfiles(profileList);
      } catch (err) {
        console.error("[prepare] Load failed:", err);
        router.replace("/poju");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  function handleProfileSelected(profileId: string) {
    router.push(`/poju/session/${sessionId}/preparing?profile=${encodeURIComponent(profileId)}`);
  }

  function handleRefund() {
    router.push(`/poju/session/${sessionId}/refund`);
  }

  if (loading) {
    return <div className="session-prep-loading">{t("loading")}</div>;
  }

  if (!session) return null;

  return (
    <SessionPreparation
      sessionId={sessionId}
      existingProfiles={profiles}
      onProfileSelected={handleProfileSelected}
      onRefund={handleRefund}
      locale={locale}
    />
  );
}
