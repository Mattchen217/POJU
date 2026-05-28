"use client";

import { useState } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { injectToolResultToPoju } from "@/lib/poju/inject-tool-result";
import { clearPojuToolHandoff, loadPojuToolHandoff } from "@/lib/poju/poju-tool-handoff";
import type { ToolName } from "@/lib/poju/types";

type Props = {
  tool: ToolName;
  resultId: string;
  resultData: Record<string, unknown>;
  variant?: "banner" | "footer";
};

export function ReturnToPojuCTA({ tool, resultId, resultData, variant = "footer" }: Props) {
  const router = useRouter();
  const t = useTranslations("poju.tool_handoff");
  const handoff = loadPojuToolHandoff(tool);
  const [busy, setBusy] = useState(false);

  if (!handoff) return null;

  async function handleReturn() {
    if (busy) return;
    setBusy(true);
    try {
      await injectToolResultToPoju({
        session_id: handoff!.session_id,
        tool,
        result_id: resultId,
        result_data: resultData,
      });
      clearPojuToolHandoff();
      router.push(`/poju/session/${handoff!.session_id}`);
    } catch (e) {
      console.error("[return-to-poju]", e);
      setBusy(false);
    }
  }

  if (variant === "banner") {
    return (
      <div className="return-to-poju-banner">
        <button type="button" className="return-to-poju-banner__btn" onClick={() => void handleReturn()} disabled={busy}>
          <IconArrowLeft size={18} stroke={1.75} aria-hidden />
          <span>{busy ? t("returning") : t("return_banner")}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="return-to-poju-cta">
      <button type="button" className="return-to-poju-cta__primary" onClick={() => void handleReturn()} disabled={busy}>
        {busy ? t("returning") : t("return_footer")}
      </button>
    </div>
  );
}
