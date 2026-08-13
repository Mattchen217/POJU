"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "poju_llm_debug";

function parseDebugParam(value: string | null): boolean | null {
  if (value === null) return null;
  if (value === "0" || value === "false") return false;
  if (value === "1" || value === "true") return true;
  return null;
}

function readPersistedFlag(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writePersistedFlag(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(STORAGE_KEY, "1");
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / blocked storage */
  }
}

/**
 * LLM / state-machine debug panel visibility.
 * Default OFF — keep panels in the tree for later; opt in with:
 *   ?debug=1  |  NEXT_PUBLIC_SHOW_LLM_DEBUG=true  |  sessionStorage poju_llm_debug=1
 * Force off: ?debug=0 | NEXT_PUBLIC_HIDE_LLM_DEBUG=true
 */
export function useLlmDebugEnabled(): boolean {
  const searchParams = useSearchParams();
  const debugParam = searchParams.get("debug");
  const [persisted, setPersisted] = useState(false);

  useEffect(() => {
    const parsed = parseDebugParam(debugParam);
    if (parsed === false) {
      writePersistedFlag(false);
      setPersisted(false);
      return;
    }
    if (parsed === true) {
      writePersistedFlag(true);
      setPersisted(true);
      return;
    }
    setPersisted(readPersistedFlag());
  }, [debugParam]);

  return useMemo(() => {
    const fromUrl = parseDebugParam(debugParam);
    if (fromUrl === false) return false;
    if (process.env.NEXT_PUBLIC_HIDE_LLM_DEBUG === "true") return false;
    if (fromUrl === true) return true;
    if (process.env.NEXT_PUBLIC_SHOW_LLM_DEBUG === "true") return true;
    if (persisted) return true;
    // Hidden by default (dev + prod). Use ?debug=1 when needed.
    return false;
  }, [debugParam, persisted]);
}
