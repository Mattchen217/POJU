"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { BaseAnalysisDeliveryView } from "@/components/base-analysis/BaseAnalysisDeliveryView";
import { buildStreamLocalDataFromProfile } from "@/lib/base-analysis/build-stream-local-data";
import { markedTextFromStoredBaseAnalysis } from "@/lib/base-analysis/resolve-display-text";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

type BaseAnalysisViewModalProps = {
  profileId: string;
  displayName?: string;
  onClose: () => void;
};

export function BaseAnalysisViewModal({ profileId, displayName, onClose }: BaseAnalysisViewModalProps) {
  const t = useTranslations("base_analysis_view");
  const locale = useLocale();
  const [text, setText] = useState<string | null>(null);
  const [structured, setStructured] = useState<
    import("@/lib/calculations/build-profile-structured").ProfileStructured | null
  >(null);
  const [userProfile, setUserProfile] = useState<
    import("@/lib/profile/types").UserProfile | null
  >(null);
  const [metaLine, setMetaLine] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getStoredProfile(profileId);
        const displayText = markedTextFromStoredBaseAnalysis(data?.base_analysis);
        if (!displayText) {
          setError(t("not_found"));
          return;
        }
        const ba = data!.base_analysis!;
        if (!cancelled) {
          setText(displayText);
          setUserProfile(data?.user_profile ?? null);
          setStructured(
            ba.structured ??
              (data?.user_profile
                ? buildStreamLocalDataFromProfile(data.user_profile).structured
                : null),
          );
          const when = ba.generated_at ? new Date(ba.generated_at).toLocaleString() : "";
          setMetaLine(
            [displayName, when, ba.model ? `模型 ${ba.model}` : ""].filter(Boolean).join(" · "),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, displayName, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="base-analysis-view-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0c0c12] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div>
            {metaLine ? <p className="text-xs text-white/55">{metaLine}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/85 hover:bg-white/5"
          >
            {t("close")}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-3">
          {loading ? <p className="px-3 text-sm text-white/60">{t("loading")}</p> : null}
          {error ? <p className="px-3 text-sm text-red-300">{error}</p> : null}
          {text && !loading ? (
            <BaseAnalysisDeliveryView
              displayText={text}
              structured={structured}
              userProfile={userProfile}
              locale={locale}
              profileId={profileId}
              displayName={displayName}
              variant="modal"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
