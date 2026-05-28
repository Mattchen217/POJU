"use client";

import { useMemo, useState } from "react";
import {
  IconCards,
  IconCheck,
  IconCompass,
  IconHeart,
  IconInfoCircle,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { buildToolHandoffPath } from "@/lib/poju/tool-linking-routes";
import type { ToolName, ToolSuggestionPayload } from "@/lib/poju/types";

type Props = {
  suggestion: ToolSuggestionPayload;
  sessionId: string;
  cycleId: string;
  suggestionMessageId: string;
  initialResponse?: "accepted" | "declined" | null;
  onResponse: (action: "accepted" | "declined") => void;
};

const TOOL_META: Record<
  ToolName,
  {
    Icon: typeof IconHeart;
    titleKey: "match.title" | "syncro.title" | "glyph.title";
    acceptKey: "match.accept" | "syncro.accept" | "glyph.accept";
    declineKey: "match.decline" | "syncro.decline" | "glyph.decline";
  }
> = {
  match: {
    Icon: IconHeart,
    titleKey: "match.title",
    acceptKey: "match.accept",
    declineKey: "match.decline",
  },
  syncro: {
    Icon: IconCompass,
    titleKey: "syncro.title",
    acceptKey: "syncro.accept",
    declineKey: "syncro.decline",
  },
  glyph: {
    Icon: IconCards,
    titleKey: "glyph.title",
    acceptKey: "glyph.accept",
    declineKey: "glyph.decline",
  },
};

export function ToolSuggestionCard({
  suggestion,
  sessionId,
  cycleId,
  suggestionMessageId,
  initialResponse = null,
  onResponse,
}: Props) {
  const router = useRouter();
  const t = useTranslations("tool_suggestion");
  const meta = TOOL_META[suggestion.tool];
  const [responded, setResponded] = useState<"accepted" | "declined" | null>(initialResponse);

  const valueProp = useMemo(() => {
    if (suggestion.value_prop?.trim()) return suggestion.value_prop.trim();
    return suggestion.trigger_context;
  }, [suggestion.trigger_context, suggestion.value_prop]);

  const needsPartnerInfo =
    suggestion.tool === "match" && suggestion.prefill?.needs_partner_info === true;

  function handleAccept() {
    if (responded) return;
    setResponded("accepted");
    onResponse("accepted");
    const path = buildToolHandoffPath(suggestion.tool, {
      sessionId,
      cycleId,
      prefill: suggestion.prefill,
    });
    router.push(path);
  }

  function handleDecline() {
    if (responded) return;
    setResponded("declined");
    onResponse("declined");
  }

  const Icon = meta.Icon;

  return (
    <div
      className={`tool-suggestion-card tool-${suggestion.tool}`}
      data-suggestion-message-id={suggestionMessageId}
    >
      <div className="tsc-header">
        <div className="tsc-icon" aria-hidden>
          <Icon size={18} stroke={1.75} />
        </div>
        <div className="tsc-tag">{t("label")}</div>
      </div>

      <div className="tsc-title">{t(meta.titleKey)}</div>

      <div className="tsc-value-prop">{valueProp}</div>

      {needsPartnerInfo ? (
        <div className="tsc-prerequisite">
          <IconInfoCircle size={16} stroke={1.75} aria-hidden />
          <span>{t("match.needs_info")}</span>
        </div>
      ) : null}

      {!responded ? (
        <div className="tsc-actions">
          <button type="button" className="tsc-btn tsc-btn-accept" onClick={handleAccept}>
            <Icon size={18} stroke={1.75} aria-hidden />
            {t(meta.acceptKey)}
            <span className="tsc-price-tag">{t("free_in_session")}</span>
          </button>
          <button type="button" className="tsc-btn tsc-btn-decline" onClick={handleDecline}>
            {t(meta.declineKey)}
          </button>
        </div>
      ) : (
        <div className="tsc-responded">
          <IconCheck size={18} stroke={1.75} aria-hidden />
          <span>
            {responded === "accepted" ? t("accepted_continue") : t("declined_continue")}
          </span>
        </div>
      )}
    </div>
  );
}
