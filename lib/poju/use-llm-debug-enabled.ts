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

/** Whether per-reply LLM debug panels should render (URL ?debug=1, env, or persisted session flag). */
export function useLlmDebugEnabled(): boolean {
  const searchParams = useSearchParams();
  const debugParam = searchParams.get("debug");
  const [persisted, setPersisted] = useState(false);

  useEffect(() => {
    const parsed = parseDebugParam(debugParam);
    if (parsed === false) {
      sessionStorage.removeItem(STORAGE_KEY);
      setPersisted(false);
      return;
    }
    if (parsed === true) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setPersisted(true);
      return;
    }
    setPersisted(sessionStorage.getItem(STORAGE_KEY) === "1");
  }, [debugParam]);

  return useMemo(() => {
    const fromUrl = parseDebugParam(debugParam);
    if (fromUrl === false) return false;
    if (fromUrl === true) return true;
    if (process.env.NEXT_PUBLIC_SHOW_LLM_DEBUG === "true") return true;
    if (process.env.NODE_ENV === "development") return true;
    return persisted;
  }, [debugParam, persisted]);
}
