"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { SessionPreparation } from "@/components/poju/SessionPreparation";
import { useRouter } from "@/i18n/navigation";
import {
  listStoredProfilesForSessionPrep,
  type StoredProfileSummary,
} from "@/lib/profile/stored-profiles-service";

export function SyncroPreparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("syncro");

  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState("");

  useEffect(() => {
    const pendingTask = sessionStorage.getItem("syncro_task_pending");

    if (!pendingTask) {
      router.replace("/syncro/task");
      return;
    }

    setTask(pendingTask);
    sessionStorage.setItem("syncro_session_type", "free");

    void (async () => {
      try {
        const list = await listStoredProfilesForSessionPrep();
        setProfiles(list);
      } catch (e) {
        console.error("[syncro/prepare]", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router, searchParams]);

  function handleProfileSelected(profileId: string) {
    sessionStorage.setItem("syncro_profile_id", profileId);
    router.push("/syncro/preview");
  }

  function handleCancel() {
    router.push("/syncro");
  }

  if (loading) {
    return <div className="session-prep-loading">{t("loading")}</div>;
  }

  return (
    <div className="browser-flow-page">
      <SessionPreparation
        sessionId="syncro-temp"
        originalQuestion={task}
        existingProfiles={profiles}
        onProfileSelected={handleProfileSelected}
        onRefund={handleCancel}
        locale={locale}
        productType="syncro"
      />
    </div>
  );
}
