"use client";

import { useCallback, useState } from "react";

import type {
  BaseAnalysisArtifactKind,
  ProgressPayload,
} from "@/lib/base-analysis/progress-stages";

/** Accumulate progress stage + completed artifact docs for wait ritual UI. */
export function useBaseAnalysisWaitProgress() {
  const [liveProgressStage, setLiveProgressStage] = useState<string | null>(null);
  const [completedArtifacts, setCompletedArtifacts] = useState<BaseAnalysisArtifactKind[]>([]);

  const onProgress = useCallback((p: ProgressPayload) => {
    setLiveProgressStage(p.stage);
    if (p.artifact) {
      setCompletedArtifacts((prev) =>
        prev.includes(p.artifact!) ? prev : [...prev, p.artifact!],
      );
    }
  }, []);

  const reset = useCallback(() => {
    setLiveProgressStage(null);
    setCompletedArtifacts([]);
  }, []);

  return { liveProgressStage, completedArtifacts, onProgress, reset };
}
