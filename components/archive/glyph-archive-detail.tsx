"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

import { GlyphDeliveryView } from "@/components/glyph/GlyphDeliveryView";
import { useAppDialog } from "@/components/ui/app-dialog";
import { getCachedBaseAnalysis } from "@/lib/cross-product/get-cached-base-analysis";
import {
  deleteArchiveItem,
  type GlyphReadingArchiveData,
} from "@/lib/archive/archive-service";
import { loadGlyphDrawSession } from "@/lib/glyph/glyph-draw-session";
import { loadGlyphBySignData } from "@/lib/glyph/load-glyph";
import type { SignData } from "@/types/oracle";

type Props = {
  archiveId: string;
  data: GlyphReadingArchiveData;
};

export function GlyphArchiveDetail({ archiveId, data }: Props) {
  const t = useTranslations("archiveDetail");
  const tCommon = useTranslations("common");
  const tGlyph = useTranslations("glyph");
  const router = useRouter();
  const { confirm } = useAppDialog();
  const [baseReportText, setBaseReportText] = useState<string | undefined>();

  const glyph = useMemo(
    (): SignData =>
      loadGlyphBySignData({
        sign_number: data.sign_number,
        level: data.sign_level,
        verse_lines_en: [],
        summary_line_en: "",
        raw_md_content: "",
      }),
    [data.sign_level, data.sign_number],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadBaseReport() {
      const fromSession = loadGlyphDrawSession(data.reading_id)?.base_report_text?.trim();
      if (fromSession) {
        if (!cancelled) setBaseReportText(fromSession);
        return;
      }

      const cached = await getCachedBaseAnalysis(data.profile_id);
      if (!cancelled && cached?.reportText?.trim()) {
        setBaseReportText(cached.reportText.trim());
      }
    }

    void loadBaseReport();
    return () => {
      cancelled = true;
    };
  }, [data.profile_id, data.reading_id]);

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
    <GlyphDeliveryView
      variant="archive"
      reading={data.reading}
      glyph={glyph}
      question={data.question}
      readingId={data.reading_id}
      baseReportText={baseReportText}
      header={
        <div className="glyph-archive-delivery-header">
          <Link href="/archive" className="glyph-archive-delivery-header__back">
            ← {t("back")}
          </Link>
          <h1 className="glyph-archive-delivery-header__title">
            {tGlyph("archive_detail_title", {
              name: data.question?.trim() || data.glyph_display_name,
            })}
          </h1>
          <p className="glyph-archive-delivery-header__date">
            {new Date(data.delivered_at).toLocaleString()}
          </p>
        </div>
      }
      footer={
        <div className="glyph-archive-delivery-footer">
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="glyph-archive-delivery-footer__delete"
          >
            {t("delete")}
          </button>
        </div>
      }
    />
  );
}
