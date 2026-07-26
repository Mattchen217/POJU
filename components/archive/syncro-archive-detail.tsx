"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

import { useAppDialog } from "@/components/ui/app-dialog";
import { deleteArchiveItem, type SyncroTaskArchiveData } from "@/lib/archive/archive-service";
import { CURRENT_LEVELS, DIRECTIONS, type CurrentLevel, type DirectionId } from "@/lib/syncro/current-system";
import { HOUR_PERIODS } from "@/lib/syncro/types";

type Props = {
  archiveId: string;
  data: SyncroTaskArchiveData;
  locale: string;
};

function levelLabel(level: string, isZh: boolean): string {
  if (level in CURRENT_LEVELS) {
    const info = CURRENT_LEVELS[level as CurrentLevel];
    return isZh ? info.name_zh : info.name_en;
  }
  return level;
}

function directionLabel(dir: string, isZh: boolean): string {
  if (dir in DIRECTIONS) {
    const info = DIRECTIONS[dir as DirectionId];
    return isZh ? info.name_zh : info.name_en;
  }
  return dir;
}

function hourLabel(hour: string, isZh: boolean): string {
  if (hour in HOUR_PERIODS) {
    const info = HOUR_PERIODS[hour as keyof typeof HOUR_PERIODS];
    return isZh ? info.name_zh : info.name_en;
  }
  return hour;
}

export function SyncroArchiveDetail({ archiveId, data, locale }: Props) {
  const t = useTranslations("archiveDetail");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { confirm } = useAppDialog();
  const isZh = locale.startsWith("zh");

  const expired = new Date(data.expires_at).getTime() < Date.now();
  const best = data.best_combination;

  async function handleDelete() {
    const ok = await confirm(tCommon("deleteConfirmWarning"), t("delete"), {
      confirmLabel: t("delete"),
      cancelLabel: tCommon("cancel"),
      tone: "danger",
    });
    if (!ok) return;
    await deleteArchiveItem(archiveId);
    router.push("/archive");
  }

  return (
    <div className="archive-detail-page mx-auto max-w-2xl">
      <div className="detail-header mb-8">
        <Link href="/archive" className="text-sm text-cyan-300 hover:text-white">
          ← {t("back")}
        </Link>
        <h1 className="mt-4 font-['Manrope'] text-2xl font-bold text-cyan-100">{t("syncro_title")}</h1>
        {expired ? (
          <p className="mt-2 text-sm text-amber-200/90">{t("syncro_expired")}</p>
        ) : (
          <p className="mt-2 text-sm text-[#958ea0]">{t("syncro_active_until", { date: data.expires_at.slice(0, 10) })}</p>
        )}
      </div>

      <div className="original-question mb-8 rounded-xl border border-white/10 bg-black/20 p-4">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[#958ea0]">
          {t("syncro_task_label")}
        </span>
        <p className="mt-2 text-[15px] leading-relaxed text-[#e7e0ed]">{data.task_description}</p>
      </div>

      {best ? (
        <div className="mb-8 rounded-xl border border-cyan-400/25 bg-cyan-950/30 p-5">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-cyan-200/80">
            {t("syncro_best_peak")}
          </h2>
          <p className="mt-3 text-lg font-semibold" style={{ color: CURRENT_LEVELS[best.current_level as CurrentLevel]?.color_hex ?? "#67e8f9" }}>
            {levelLabel(best.current_level, isZh)}
          </p>
          <p className="mt-2 text-sm text-[#cbc3d7]">
            {hourLabel(best.hour_period, isZh)} · {directionLabel(best.direction, isZh)}
          </p>
          <p className="mt-4 text-[15px] leading-7 text-[#e7e0ed]">{best.short_advice}</p>
        </div>
      ) : null}

      <div className="detail-footer mt-10 flex flex-wrap gap-3">
        {!expired ? (
          <Link
            href={`/syncro/result/${data.syncro_session_id}`}
            className="rounded-lg border border-cyan-400/40 bg-cyan-500/25 px-5 py-2 text-sm text-cyan-100"
          >
            {t("syncro_open_live")}
          </Link>
        ) : (
          <Link
            href="/syncro"
            className="rounded-lg border border-cyan-400/40 bg-cyan-500/25 px-5 py-2 text-sm text-cyan-100"
          >
            {t("syncro_start_new")}
          </Link>
        )}
        <button
          type="button"
          onClick={() => void handleDelete()}
          className="rounded-lg border border-red-400/30 px-5 py-2 text-sm text-red-300 hover:bg-red-500/10"
        >
          {t("delete")}
        </button>
      </div>
    </div>
  );
}
