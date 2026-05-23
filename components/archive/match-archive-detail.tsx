"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

import { deleteArchiveItem, type MatchArchiveData } from "@/lib/archive/archive-service";
import {
  COMPATIBILITY_LEVELS,
  type CompatibilityLevel,
} from "@/lib/match/types";

import "@/styles/match.css";

type Props = {
  archiveId: string;
  data: MatchArchiveData;
  locale: string;
};

export function MatchArchiveDetail({ archiveId, data, locale }: Props) {
  const t = useTranslations("match.archive");
  const tDetail = useTranslations("archiveDetail");
  const router = useRouter();
  const isZh = locale.startsWith("zh");

  const levelKey = data.compatibility_level as CompatibilityLevel;
  const compatibility =
    COMPATIBILITY_LEVELS[levelKey] ?? COMPATIBILITY_LEVELS.neutral;

  async function handleDelete() {
    if (!confirm(tDetail("confirm_delete"))) return;
    await deleteArchiveItem(archiveId);
    router.push("/archive");
  }

  return (
    <div className="archive-detail-page match-archive-detail mx-auto max-w-2xl">
      <div className="detail-header mb-8">
        <Link href="/archive" className="text-sm text-amber-200/90 hover:text-[#f5ecd4]">
          ← {tDetail("back")}
        </Link>
        <h1 className="mt-4 font-['Manrope'] text-2xl font-bold text-[#d4af37]">{t("detail_title")}</h1>
      </div>

      <div className="match-archive-relationship rounded-xl border border-white/10 bg-black/20 p-4">
        <span className="match-archive-label">{t("relationship_label")}</span>
        <p className="match-archive-relationship-text">&ldquo;{data.relationship_description}&rdquo;</p>
      </div>

      <div
        className="match-archive-compatibility-line"
        style={{
          borderColor: compatibility.color_hex,
          color: compatibility.color_hex,
        }}
      >
        {isZh ? compatibility.name_zh : compatibility.name_en}
      </div>

      <section className="match-archive-summary-section">
        <h2>{t("overall")}</h2>
        <p>{data.summary.overall_summary}</p>
      </section>

      <section className="match-archive-summary-section">
        <h2>A</h2>
        <p>{data.summary.a_summary}</p>
      </section>

      <section className="match-archive-summary-section">
        <h2>B</h2>
        <p>{data.summary.b_summary}</p>
      </section>

      {data.summary.top_actions.length > 0 ? (
        <section className="match-archive-summary-section">
          <h2>{t("top_actions")}</h2>
          <ul className="match-archive-actions-list">
            {data.summary.top_actions.map((action, i) => (
              <li key={i}>
                {i + 1}. {action}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="detail-footer mt-10 flex flex-wrap gap-3">
        <Link
          href={`/match/result/${data.match_session_id}`}
          className="match-primary-btn match-archive-view-full"
        >
          {t("view_full_report")}
        </Link>
        <button
          type="button"
          onClick={() => void handleDelete()}
          className="rounded-lg border border-red-400/30 px-5 py-2 text-sm text-red-300 hover:bg-red-500/10"
        >
          {tDetail("delete")}
        </button>
      </div>
    </div>
  );
}
