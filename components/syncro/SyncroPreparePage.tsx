"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { SessionPreparation } from "@/components/poju/SessionPreparation";
import { PojuToolHandoffBanner } from "@/components/poju/PojuToolHandoffBanner";
import { SyncroExistingSessionPrompt } from "@/components/syncro/SyncroExistingSessionPrompt";
import {
  SYNCRO_TASK_MIN_LEN,
  SyncroTaskInputSection,
} from "@/components/syncro/SyncroTaskInputSection";
import { Link, useRouter } from "@/i18n/navigation";
import { usePojuToolHandoff } from "@/lib/poju/use-poju-tool-handoff";
import {
  listStoredProfilesForSessionPrep,
  type StoredProfileSummary,
} from "@/lib/profile/stored-profiles-service";
import { inferTaskTimeScope, SYNCRO_TASK_TIME_KEY } from "@/lib/syncro/syncro-view-helpers";
import "@/styles/poju-tool-handoff.css";

export function SyncroPreparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("syncro");
  const tTask = useTranslations("syncro.task");

  const pojuHandoff = usePojuToolHandoff("syncro");
  const forceNew = searchParams.get("new") === "1";

  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState("");
  const [showTaskWarning, setShowTaskWarning] = useState(false);
  const [taskPrefilled, setTaskPrefilled] = useState(false);

  useEffect(() => {
    const sessionType = searchParams.get("type") === "paid" ? "paid" : "free";
    sessionStorage.setItem("syncro_session_type", sessionType);
  }, [searchParams]);

  useEffect(() => {
    if (taskPrefilled) return;
    const stored = sessionStorage.getItem("syncro_task_pending");
    const fromUrl = searchParams.get("task_description");
    const fromHandoff = pojuHandoff?.prefill.task_description;
    const next = stored || fromHandoff || fromUrl || "";
    if (next) setTask(next);
    setTaskPrefilled(true);
  }, [pojuHandoff, searchParams, taskPrefilled]);

  useEffect(() => {
    if (task.trim().length >= SYNCRO_TASK_MIN_LEN) setShowTaskWarning(false);
  }, [task]);

  useEffect(() => {
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
  }, []);

  function taskIsValid(): boolean {
    return task.trim().length >= SYNCRO_TASK_MIN_LEN;
  }

  function persistTask(): boolean {
    const trimmed = task.trim();
    if (trimmed.length < SYNCRO_TASK_MIN_LEN) {
      setShowTaskWarning(true);
      document.getElementById("syncro-task-input")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    sessionStorage.setItem("syncro_task_pending", trimmed);
    sessionStorage.setItem(SYNCRO_TASK_TIME_KEY, inferTaskTimeScope(trimmed));
    return true;
  }

  function handleProfileSelected(profileId: string) {
    if (!persistTask()) return;
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
    <div className="browser-flow-page syncro-prepare-page">
      <div className="mx-auto w-full max-w-lg px-4 pb-8 pt-6">
        <Link href="/syncro" className="inline-flex text-sm text-cyan-200/80 hover:text-cyan-100">
          ← {tTask("back")}
        </Link>

        {pojuHandoff ? <PojuToolHandoffBanner handoff={pojuHandoff} className="mt-6" /> : null}

        {!forceNew ? (
          <SyncroExistingSessionPrompt
            onStartNew={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("new", "1");
              router.replace(`/syncro/prepare?${params.toString()}`);
            }}
          />
        ) : null}
      </div>

      <SessionPreparation
        sessionId="syncro-temp"
        existingProfiles={profiles}
        onProfileSelected={handleProfileSelected}
        onRefund={handleCancel}
        locale={locale}
        productType="syncro"
        canProceed={taskIsValid}
        onProceedBlocked={() => {
          setShowTaskWarning(true);
          document.getElementById("syncro-task-input")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        footerSlot={
          <SyncroTaskInputSection
            task={task}
            onTaskChange={setTask}
            showMinWarning={showTaskWarning}
          />
        }
      />
    </div>
  );
}
