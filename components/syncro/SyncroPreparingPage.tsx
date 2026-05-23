"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { generateBaseAnalysis } from "@/lib/llm/deepseek/base-analysis";
import { getStoredProfileRecord } from "@/lib/profile/stored-profiles-service";

/** 选中尚未生成基础分析的命主后，先跑 base analysis 再进位置授权。 */
export function SyncroPreparingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("session_prep");

  const profileId = searchParams.get("profile")?.trim() ?? "";
  const startedRef = useRef(false);

  useEffect(() => {
    if (!profileId) {
      router.replace("/syncro/prepare");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        const record = await getStoredProfileRecord(profileId);
        if (!record) {
          router.replace("/syncro/prepare");
          return;
        }
        if (record.has_base_analysis) {
          router.replace("/syncro/location");
          return;
        }
        await generateBaseAnalysis(profileId);
        router.replace("/syncro/location");
      } catch (e) {
        console.error("[syncro/preparing]", e);
        router.replace("/syncro/prepare");
      }
    })();
  }, [profileId, router]);

  return <div className="session-prep-loading">{t("preparing")}</div>;
}
