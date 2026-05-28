"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { getToolResult } from "@/lib/cross-product/get-tool-result";
import {
  readFromToolPending,
  setFromToolPending,
} from "@/lib/cross-product/from-tool-pending";
import { buildSuggestedQuestionFromTool } from "@/lib/cross-product/suggested-question-from-tool";
import { renderToolPreviewText } from "@/lib/cross-product/tool-result-preview";
import type { ToolName } from "@/lib/poju/types";
import "@/styles/poju-deep-dive.css";

function isToolName(v: string | null): v is ToolName {
  return v === "match" || v === "syncro" || v === "glyph";
}

function PojuFromToolEntryInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const t = useTranslations("cross_product.from_tool_entry");
  const [preview, setPreview] = useState<string | null>(null);
  const [toolLabel, setToolLabel] = useState<string | null>(null);

  useEffect(() => {
    const toolRaw = searchParams.get("from_tool");
    const resultId = searchParams.get("result_id")?.trim();
    if (!isToolName(toolRaw) || !resultId) return;

    let cancelled = false;
    void (async () => {
      const data = await getToolResult(toolRaw, resultId);
      if (cancelled || !data) return;
      const suggested = buildSuggestedQuestionFromTool(toolRaw, data);
      setFromToolPending({
        tool: toolRaw,
        result_id: resultId,
        result_data: data,
        suggested_question: suggested,
      });
      if (typeof window !== "undefined") {
        sessionStorage.setItem("poju_pending_question", suggested);
      }
      setToolLabel(toolRaw);
      setPreview(renderToolPreviewText(toolRaw, data));
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const pending = readFromToolPending();
  const showBanner = Boolean(pending || preview);

  if (!showBanner) {
    return <>{children}</>;
  }

  const tool = pending?.tool ?? toolLabel ?? "tool";

  return (
    <>
      <div className="poju-from-tool-banner">{t("continuing_from", { tool })}</div>
      {preview ? (
        <div className="poju-tool-context-card">
          <div className="context-label">{t("context_label")}</div>
          <div className="context-preview">{preview}</div>
        </div>
      ) : null}
      {children}
    </>
  );
}

export function PojuFromToolEntry({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={children}>
      <PojuFromToolEntryInner>{children}</PojuFromToolEntryInner>
    </Suspense>
  );
}
