"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import {
  ensureV2DefaultShellMigrated,
  resolveUiShell,
  writeStoredUiShell,
  parseUiShellValue,
} from "@/lib/ui-shell/resolve-ui-shell";

/**
 * Sets `html[data-ui-shell=classic|workspace]` for CSS and chrome branching.
 * Persists `?ui=` overrides into localStorage.
 */
export function UiShellBootstrap() {
  const searchParams = useSearchParams();
  const uiParam = searchParams.get("ui");

  useEffect(() => {
    ensureV2DefaultShellMigrated();
    const parsed = parseUiShellValue(uiParam);
    if (parsed) {
      writeStoredUiShell(parsed);
    }
    const mode = resolveUiShell({
      query: uiParam ? new URLSearchParams(`ui=${uiParam}`) : null,
    });
    document.documentElement.setAttribute("data-ui-shell", mode);
  }, [uiParam]);

  return null;
}
