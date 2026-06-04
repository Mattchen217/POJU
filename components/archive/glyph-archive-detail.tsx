"use client";

import "@/styles/glyph-home.css";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { GlyphReport } from "@/components/glyph/GlyphReport";
import {
  deleteArchiveItem,
  type GlyphReadingArchiveData,
} from "@/lib/archive/archive-service";
import { pojuChatColumn } from "@/lib/poju/chat-layout";
import { cn } from "@/lib/utils/classnames";
import type { SignData } from "@/types/oracle";

type Props = {
  archiveId: string;
  data: GlyphReadingArchiveData;
};

export function GlyphArchiveDetail({ archiveId, data }: Props) {
  const t = useTranslations("archiveDetail");
  const tGlyph = useTranslations("glyph");
  const router = useRouter();

  const glyphStub: SignData = {
    sign_number: data.sign_number,
    level: data.sign_level,
    verse_lines_en: [],
    summary_line_en: "",
    raw_md_content: "",
  };

  async function handleDelete() {
    if (!confirm(t("confirm_delete"))) return;
    await deleteArchiveItem(archiveId);
    router.push("/archive");
  }

  return (
    <div className={cn("archive-detail-page browser-flow-page px-4 md:px-6", pojuChatColumn)}>
      <div className="detail-header mb-8">
        <Link href="/archive" className="text-sm text-violet-300 hover:text-white">
          ← {t("back")}
        </Link>
        <h1 className="mt-4 font-['Manrope'] text-2xl font-bold text-[#d0bcff]">
          {tGlyph("archive_detail_title", { name: data.glyph_display_name })}
        </h1>
        <p className="mt-1 text-sm text-[#958ea0]">{data.wind_category}</p>
      </div>

      <GlyphReport
        reading={data.reading}
        glyph={glyphStub}
        question={data.question}
      />

      <div className="detail-footer mt-10 flex flex-wrap gap-3">
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
