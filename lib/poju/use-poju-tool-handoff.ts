"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  loadPojuToolHandoff,
  readPojuHandoffFromSearchParams,
  savePojuToolHandoff,
  type PojuToolHandoff,
} from "@/lib/poju/poju-tool-handoff";
import { checkPojuQuota } from "@/lib/poju/tool-quota-check";
import type { ToolName } from "@/lib/poju/types";

/**
 * Capture POJU → tool URL params, verify cycle quota, persist for the tool flow.
 */
export function usePojuToolHandoff(tool: ToolName): PojuToolHandoff | null {
  const searchParams = useSearchParams();
  const [handoff, setHandoff] = useState<PojuToolHandoff | null>(null);

  useEffect(() => {
    const fromUrl = readPojuHandoffFromSearchParams(searchParams, tool);
    if (!fromUrl) {
      setHandoff(loadPojuToolHandoff(tool));
      return;
    }

    let cancelled = false;
    void (async () => {
      const quota_free = await checkPojuQuota(tool, fromUrl.session_id, fromUrl.cycle_id);
      const saved: PojuToolHandoff = {
        ...fromUrl,
        quota_free,
        captured_at: new Date().toISOString(),
      };
      if (cancelled) return;
      savePojuToolHandoff(saved);
      setHandoff(saved);
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, tool]);

  return handoff;
}
