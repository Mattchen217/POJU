"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { formatBaseAnalysisForDisplay } from "@/lib/profile/format-base-analysis-zh";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

type BaseAnalysisViewModalProps = {
  profileId: string;
  displayName?: string;
  onClose: () => void;
};

export function BaseAnalysisViewModal({ profileId, displayName, onClose }: BaseAnalysisViewModalProps) {
  const t = useTranslations("base_analysis_view");
  const [text, setText] = useState<string | null>(null);
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
        if (!data?.base_analysis) {
          setError(t("not_found"));
          return;
        }
        const ba = data.base_analysis;
        if (!cancelled) {
          setText(
            formatBaseAnalysisForDisplay({
              content: ba.content,
              raw_text: ba.raw_text,
            }),
          );
          const when = ba.generated_at ? new Date(ba.generated_at).toLocaleString("zh-CN") : "";
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
        className="flex max-h-[min(92vh,720px)] w-full max-w-2xl flex-col rounded-t-2xl border border-white/10 bg-[#0c0c12] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
          <div>
            <h2 id="base-analysis-view-title" className="text-lg font-semibold text-white">
              {t("title")}
            </h2>
            {metaLine ? <p className="mt-1 text-xs text-white/55">{metaLine}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/85 hover:bg-white/5"
          >
            {t("close")}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? <p className="text-sm text-white/60">{t("loading")}</p> : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {text && !loading ? (
            <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-7 text-white/90">
              {text}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}
