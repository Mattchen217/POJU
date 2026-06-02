"use client";

import { createContext, useContext, useEffect } from "react";
import type { Application } from "@splinetool/runtime";

type PreparingSplineControl = {
  registerApp: (app: Application | null) => void;
  pauseScene: () => void;
  setBlockInteraction: (active: boolean) => void;
};

export const PreparingSplineControlContext = createContext<PreparingSplineControl | null>(null);

export function usePreparingSplineControl(): PreparingSplineControl | null {
  return useContext(PreparingSplineControlContext);
}

/** Tell the layout-owned Spline shell to block pointer input (streaming / error / cache). */
export function usePreparingBlockInput(active: boolean): void {
  const control = usePreparingSplineControl();
  useEffect(() => {
    control?.setBlockInteraction(active);
    return () => control?.setBlockInteraction(false);
  }, [active, control]);
}
