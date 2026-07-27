"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

import {
  parseUiShellValue,
  readStoredUiShell,
  resolveUiShell,
  UI_SHELL_STORAGE_KEY,
  writeStoredUiShell,
  type UiShellMode,
} from "@/lib/ui-shell/resolve-ui-shell";

const listeners = new Set<() => void>();

function emitShellChange(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === UI_SHELL_STORAGE_KEY || e.key === null) listener();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getStoredSnapshot(): UiShellMode | null {
  return readStoredUiShell();
}

function getServerSnapshot(): UiShellMode | null {
  return null;
}

export function useUiShell(): {
  shell: UiShellMode;
  setShell: (mode: UiShellMode) => void;
  ready: boolean;
} {
  const searchParams = useSearchParams();
  const uiParam = searchParams.get("ui");
  const stored = useSyncExternalStore(subscribe, getStoredSnapshot, getServerSnapshot);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const parsed = parseUiShellValue(uiParam);
    if (!parsed) return;
    writeStoredUiShell(parsed);
    emitShellChange();
  }, [uiParam]);

  const shell = resolveUiShell({
    query: uiParam ? new URLSearchParams(`ui=${uiParam}`) : null,
    stored,
  });

  const setShell = useCallback((mode: UiShellMode) => {
    writeStoredUiShell(mode);
    emitShellChange();
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-ui-shell", mode);
    }
  }, []);

  // Prefer env/query immediately; do not wait on `ready` or the home chrome will
  // flash classic nav around the V2 landing.
  return { shell, setShell, ready };
}
