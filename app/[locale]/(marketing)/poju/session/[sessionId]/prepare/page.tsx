"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { SessionPreparation } from "@/components/poju/SessionPreparation";
import { loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import { bindPreviewProfileToSession } from "@/lib/poju/preview-unlock";
import { sessionMatrixReadyForChat } from "@/lib/poju/matrix-narrative-ready";
import {
  listStoredProfilesForSessionPrep,
  recordProfileUsage,
  type StoredProfileSummary,
} from "@/lib/profile/stored-profiles-service";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import type { POJUSessionState } from "@/lib/poju/types";
import "@/styles/session-prep.css";
import "@/styles/chart-loader.css";

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
          if (sessionMatrixReadyForChat(sessionData)) {
            router.replace(`/poju/session/${sessionId}`);
          } else {
            router.replace(
              `/poju/session/${sessionId}/preparing?profile=${encodeURIComponent(sessionData.selected_stored_profile_id)}`,
            );
          }
          return;
        }

        const profileList = await listStoredProfilesForSessionPrep();
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

  async function handleProfileSelected(profileId: string) {
    try {
      const sessionData = await loadPOJUSession(sessionId);
      if (!sessionData) {
        router.replace("/poju");
        return;
      }
      const bound = await bindPreviewProfileToSession(sessionData, profileId, locale);
      await savePOJUSession(bound);
      await recordProfileUsage(profileId, "poju");
      router.replace(
        `/poju/session/${sessionId}/preparing?profile=${encodeURIComponent(profileId)}`,
      );
    } catch (err) {
      console.error("[prepare] Profile bind failed:", err);
      router.replace("/poju");
    }
  }

  function handleRefund() {
    router.push(`/poju/session/${sessionId}/refund`);
  }

  if (loading) {
    return <div className="session-prep-loading">{t("loading")}</div>;
  }

  if (!session) return null;

  return (
    <div className="browser-flow-page">
      <SessionPreparation
        sessionId={sessionId}
        existingProfiles={profiles}
        onProfileSelected={handleProfileSelected}
        onRefund={handleRefund}
        locale={locale}
      />
    </div>
  );
}
