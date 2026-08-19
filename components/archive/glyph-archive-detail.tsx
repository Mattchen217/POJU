"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

import { GlyphDeliveryView } from "@/components/glyph/GlyphDeliveryView";
import { useAppDialog } from "@/components/ui/app-dialog";
import {
  deleteArchiveItem,
  type GlyphReadingArchiveData,
} from "@/lib/archive/archive-service";
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
