"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Props = {
  archiveId: string;
};

export function ArchiveSavedHint({ archiveId }: Props) {
  const t = useTranslations("poju.archive_hint");

  return (
    <div className="archive-saved-hint mt-6 rounded-xl border border-violet-400/25 bg-violet-500/[0.08] p-4">
      <div className="flex gap-3">
        <div className="text-2xl" aria-hidden>
          📂
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-violet-100">{t("saved_title")}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/70">{t("saved_text")}</p>
          <Link
            href={`/archive/${archiveId}`}
            className="hint-button mt-3 inline-flex rounded-lg border border-violet-400/40 bg-violet-500/20 px-4 py-2 text-xs font-medium text-violet-100 transition-colors hover:bg-violet-500/30"
          >
            {t("view_in_archive")}
          </Link>
        </div>
      </div>
    </div>
  );
}
