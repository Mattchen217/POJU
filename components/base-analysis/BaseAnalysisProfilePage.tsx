"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import { BaseAnalysisDeliveryView } from "@/components/base-analysis/BaseAnalysisDeliveryView";
import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import { markedTextFromStoredBaseAnalysis } from "@/lib/base-analysis/resolve-display-text";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  getStoredProfile,
  getStoredProfileRecord,
} from "@/lib/profile/stored-profiles-service";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      displayText: string;
      structured: ProfileStructured;
      displayName: string;
      generatedAt?: string;
    };

export function BaseAnalysisProfilePage() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations("base_analysis_view");
  const profileId = typeof params.profileId === "string" ? params.profileId : "";

  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    if (!profileId) {
      setState({ status: "error", message: t("not_found") });
      return;
    }
    setState({ status: "loading" });
    try {
      const [data, record] = await Promise.all([
        getStoredProfile(profileId),
        getStoredProfileRecord(profileId),
      ]);
      if (!data?.user_profile) {
        setState({ status: "error", message: t("not_found") });
        return;
      }

      const displayText = markedTextFromStoredBaseAnalysis(data.base_analysis);
      if (!displayText) {
        setState({ status: "error", message: t("not_found") });
        return;
      }

      const structured =
        data.base_analysis?.structured ??
        buildStreamLocalDataFromProfile(data.user_profile).structured;

      setState({
        status: "ready",
        displayText,
        structured,
        displayName: record?.display_name?.trim() || "",
        generatedAt: data.base_analysis?.generated_at,
      });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [profileId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <main className="base-analysis-profile-page browser-flow-page min-h-screen">
        <p className="px-6 py-16 text-center text-sm text-white/55">{t("loading")}</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="base-analysis-profile-page browser-flow-page min-h-screen px-6 py-16">
        <p className="mx-auto max-w-lg text-center text-sm text-red-300">{state.message}</p>
        <p className="mt-4 text-center">
          <Link href="/" className="text-sm text-amber-200/80 hover:text-amber-100">
            ← POJU
          </Link>
        </p>
      </main>
    );
  }

  const metaLine = state.generatedAt
    ? new Date(state.generatedAt).toLocaleString()
    : "";

  return (
    <main className="base-analysis-profile-page browser-flow-page min-h-screen reading-ritual-fade-in">
      <BaseAnalysisDeliveryView
        displayText={state.displayText}
        structured={state.structured}
        locale={locale}
        profileId={profileId}
        displayName={state.displayName || undefined}
        variant="page"
        header={
          <div className="glyph-archive-delivery-header base-analysis-profile-page__header">
            <Link href="/" className="glyph-archive-delivery-header__back">
              ← POJU
            </Link>
            {metaLine ? (
              <p className="glyph-archive-delivery-header__date">{metaLine}</p>
            ) : null}
          </div>
        }
      />
    </main>
  );
}
