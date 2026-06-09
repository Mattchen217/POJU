"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

import { GlyphArchiveDetail } from "@/components/archive/glyph-archive-detail";
import { MatchArchiveDetail } from "@/components/archive/match-archive-detail";
import { SyncroArchiveDetail } from "@/components/archive/syncro-archive-detail";
import {
  deleteArchiveItem,
  loadArchiveItem,
  loadGlyphReading,
  loadMatchArchive,
  loadSyncroArchive,
  updateArchiveActionStatus,
  type GlyphReadingArchiveData,
  type MatchArchiveData,
  type POJUActionRecommendationsData,
  type SyncroTaskArchiveData,
} from "@/lib/archive/archive-service";

type Props = {
  archiveId: string;
};

export function ArchiveDetailClient({ archiveId }: Props) {
  const t = useTranslations("archiveDetail");
  const locale = useLocale();
  const router = useRouter();
  const [pojuData, setPojuData] = useState<POJUActionRecommendationsData | null>(null);
  const [glyphData, setGlyphData] = useState<GlyphReadingArchiveData | null>(null);
  const [syncroData, setSyncroData] = useState<SyncroTaskArchiveData | null>(null);
  const [matchData, setMatchData] = useState<MatchArchiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    void (async () => {
      const match = await loadMatchArchive(archiveId);
      if (stop) return;
      if (match) {
        setMatchData(match);
        setSyncroData(null);
        setGlyphData(null);
        setPojuData(null);
        setLoading(false);
        return;
      }
      const syncro = await loadSyncroArchive(archiveId);
      if (stop) return;
      if (syncro) {
        setSyncroData(syncro);
        setMatchData(null);
        setGlyphData(null);
        setPojuData(null);
        setLoading(false);
        return;
      }
      const glyph = await loadGlyphReading(archiveId);
      if (stop) return;
      if (glyph) {
        setGlyphData(glyph);
        setMatchData(null);
        setSyncroData(null);
        setPojuData(null);
        setLoading(false);
        return;
      }
      const poju = await loadArchiveItem(archiveId);
      if (!stop) {
        setMatchData(null);
        setSyncroData(null);
        setGlyphData(null);
        setPojuData(poju);
        setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [archiveId]);

  async function handleUpdateStatus(
    actionId: string,
    status: "completed" | "modified" | "skipped",
    feedback?: string,
  ) {
    await updateArchiveActionStatus(archiveId, actionId, status, feedback);
    const updated = await loadArchiveItem(archiveId);
    setPojuData(updated);
  }

  async function handleDelete() {
    if (!confirm(t("confirm_delete"))) return;
    await deleteArchiveItem(archiveId);
    router.push("/archive");
  }

  if (loading) {
    return <p className="py-8 text-sm text-[#cbc3d7]/70">{t("loading")}</p>;
  }
  if (matchData) {
    return <MatchArchiveDetail archiveId={archiveId} data={matchData} locale={locale} />;
  }

  if (glyphData) {
    return <GlyphArchiveDetail archiveId={archiveId} data={glyphData} />;
  }

  if (syncroData) {
    return <SyncroArchiveDetail archiveId={archiveId} data={syncroData} locale={locale} />;
  }

  if (!pojuData) {
    return <p className="py-8 text-sm text-[#cbc3d7]/70">{t("not_found")}</p>;
  }

  const data = pojuData;

  return (
    <div className="archive-detail-page mx-auto max-w-2xl">
      <div className="detail-header mb-8">
        <Link href="/archive" className="text-sm text-violet-300 hover:text-white">
          ← {t("back")}
        </Link>
        <h1 className="mt-4 font-['Manrope'] text-2xl font-bold text-[#d0bcff]">{t("title")}</h1>
      </div>

      <div className="original-question mb-8 rounded-xl border border-white/10 bg-black/20 p-4">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[#958ea0]">{t("original_question_label")}</span>
        <p className="mt-2 text-[15px] leading-relaxed text-[#e7e0ed]">{data.original_question}</p>
      </div>

      {data.delivery_excerpt ? (
        <div className="delivery-excerpt mb-8 rounded-xl border border-white/10 bg-black/20 p-4">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[#958ea0]">{t("delivery_excerpt_label")}</span>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[#e7e0ed]">{data.delivery_excerpt}</p>
        </div>
      ) : null}

      <div className="actions-list space-y-4">
        {data.actions.map((action, idx) => (
          <ArchiveActionCard
            key={action.action_id}
            action={action}
            index={idx + 1}
            onStatusChange={(status, feedback) => void handleUpdateStatus(action.action_id, status, feedback)}
          />
        ))}
      </div>

      <div className="detail-footer mt-10 flex flex-wrap gap-3">
        {data.session_id ? (
          <Link
            href={`/poju/session/${data.session_id}`}
            className="primary rounded-lg border border-violet-400/40 bg-violet-500/25 px-5 py-2 text-sm text-violet-100"
          >
            {t("back_to_session")}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => void handleDelete()}
          className="danger rounded-lg border border-red-400/30 px-5 py-2 text-sm text-red-300 hover:bg-red-500/10"
        >
          {t("delete")}
        </button>
      </div>
    </div>
  );
}

function ArchiveActionCard({
  action,
  index,
  onStatusChange,
}: {
  action: POJUActionRecommendationsData["actions"][number];
  index: number;
  onStatusChange: (status: "completed" | "modified" | "skipped", feedback?: string) => void;
}) {
  const t = useTranslations("archiveDetail");

  const categoryIcons: Record<string, string> = {
    traditional_fengshui: "🏯",
    modern_decisive: "⚡",
    modern_reflective: "📔",
  };

  const categoryLabels: Record<string, string> = {
    traditional_fengshui: t("cat_traditional"),
    modern_decisive: t("cat_decisive"),
    modern_reflective: t("cat_reflective"),
  };

  const border =
    action.category === "traditional_fengshui"
      ? "border-l-amber-400"
      : action.category === "modern_decisive"
        ? "border-l-violet-400"
        : "border-l-sky-400";

  return (
    <div className={`archive-action-card status-${action.status} rounded-xl border border-white/10 border-l-4 bg-black/25 p-4 ${border}`}>
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white/80">
          {index}
        </div>
        <div className="action-body min-w-0 flex-1">
          <div className="action-header flex items-center gap-2 text-[11px] uppercase tracking-wide text-[#958ea0]">
            <span>{categoryIcons[action.category] ?? "•"}</span>
            <span>{categoryLabels[action.category] ?? action.category}</span>
          </div>

          <h3 className="action-title mt-2 text-base font-semibold text-[#e7e0ed]">{action.title}</h3>
          <p className="action-description mt-2 text-sm leading-relaxed text-white/80">{action.description}</p>

          {action.rationale ? (
            <details className="action-rationale mt-3 text-sm text-white/65">
              <summary className="cursor-pointer text-violet-200/90">{t("rationale_label")}</summary>
              <p className="mt-2">{action.rationale}</p>
            </details>
          ) : null}

          {action.status === "pending" ? (
            <div className="action-buttons mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onStatusChange("completed")}
                className="btn-complete rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs text-white"
              >
                ✓ {t("mark_done")}
              </button>
              <button
                type="button"
                onClick={() => onStatusChange("skipped")}
                className="btn-skip rounded-lg border border-white/20 px-3 py-1.5 text-xs"
              >
                ○ {t("skip")}
              </button>
            </div>
          ) : (
            <div className={`status-badge mt-3 text-xs font-medium ${action.status}`}>
              {action.status === "completed" && `✓ ${t("done")}`}
              {action.status === "skipped" && `○ ${t("skipped")}`}
              {action.status === "modified" && `~ ${t("modified")}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
