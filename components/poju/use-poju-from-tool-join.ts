"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { getToolResult } from "@/lib/cross-product/get-tool-result";
import { injectToolResultToPoju } from "@/lib/poju/inject-tool-result";
import type { ToolName } from "@/lib/poju/types";

function isToolName(v: string | null): v is ToolName {
  return v === "match" || v === "syncro" || v === "glyph";
}

/** Join existing POJU session with a tool result from `?from_tool=&result_id=`. */
export function usePojuFromToolJoin(sessionId: string, onJoined?: () => void) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const toolRaw = searchParams.get("from_tool");
    const resultId = searchParams.get("result_id")?.trim();
    if (!isToolName(toolRaw) || !resultId || !sessionId) return;

    let cancelled = false;
    setJoining(true);

    void (async () => {
      try {
        const data = await getToolResult(toolRaw, resultId);
        if (data) {
          await injectToolResultToPoju({
            session_id: sessionId,
            tool: toolRaw,
            result_id: resultId,
            result_data: data,
          });
          onJoined?.();
        }
      } catch (e) {
        console.error("[poju-from-tool-join]", e);
      } finally {
        if (!cancelled) {
          router.replace(`/poju/session/${sessionId}`);
          setJoining(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, sessionId, router, onJoined]);

  return { joiningFromTool: joining };
}
