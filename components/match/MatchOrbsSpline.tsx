"use client";

import { useCallback, type CSSProperties } from "react";
import type { Application } from "@splinetool/runtime";

import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";
import { configureMatchHowWorksSplineFraming } from "@/lib/match/configure-match-how-works-spline-framing";
import {
  MATCH_ANALYZING_ORBS_DISPLAY_SCALE,
  MATCH_ANALYZING_ORBS_SCENE_PAN_X,
  MATCH_ANALYZING_ORBS_SCENE_SCALE,
  MATCH_ANALYZING_ORBS_SHELL_HEIGHT_RATIO,
  MATCH_ANALYZING_ORBS_SHELL_OFFSET_X,
  MATCH_ANALYZING_ORBS_SHELL_OFFSET_Y,
  MATCH_ANALYZING_ORBS_SHELL_WIDTH_RATIO,
  MATCH_HOW_WORKS_SPLINE_DISPLAY_SCALE,
  MATCH_HOW_WORKS_SPLINE_SCENE,
  MATCH_HOW_WORKS_SPLINE_SCENE_PAN_X,
  MATCH_HOW_WORKS_SPLINE_SCENE_SCALE,
  MATCH_HOW_WORKS_SPLINE_SHELL_HEIGHT_RATIO,
  MATCH_HOW_WORKS_SPLINE_SHELL_OFFSET_X,
  MATCH_HOW_WORKS_SPLINE_SHELL_OFFSET_Y,
  MATCH_HOW_WORKS_SPLINE_ZOOM,
} from "@/lib/match/match-spline-scene";
import { type HeavyWebGLContext } from "@/lib/client/allow-heavy-webgl";
import { cn } from "@/lib/utils/classnames";

type MatchOrbsSplineVariant = "howWorks" | "analyzing";

type Props = {
  className?: string;
  variant?: MatchOrbsSplineVariant;
  webGLContext?: HeavyWebGLContext;
};

const ORBS_VARIANT_CONFIG = {
  howWorks: {
    displayScale: MATCH_HOW_WORKS_SPLINE_DISPLAY_SCALE,
    heightRatio: MATCH_HOW_WORKS_SPLINE_SHELL_HEIGHT_RATIO,
    widthRatio: 1,
    offsetX: MATCH_HOW_WORKS_SPLINE_SHELL_OFFSET_X,
    offsetY: MATCH_HOW_WORKS_SPLINE_SHELL_OFFSET_Y,
    panX: MATCH_HOW_WORKS_SPLINE_SCENE_PAN_X,
    sceneScale: MATCH_HOW_WORKS_SPLINE_SCENE_SCALE,
  },
  analyzing: {
    displayScale: MATCH_ANALYZING_ORBS_DISPLAY_SCALE,
    heightRatio: MATCH_ANALYZING_ORBS_SHELL_HEIGHT_RATIO,
    widthRatio: MATCH_ANALYZING_ORBS_SHELL_WIDTH_RATIO,
    offsetX: MATCH_ANALYZING_ORBS_SHELL_OFFSET_X,
    offsetY: MATCH_ANALYZING_ORBS_SHELL_OFFSET_Y,
    panX: MATCH_ANALYZING_ORBS_SCENE_PAN_X,
    sceneScale: MATCH_ANALYZING_ORBS_SCENE_SCALE,
  },
} as const;

/** Red / green orbs Spline — shared by How Match works + analyzing wait. */
export function MatchOrbsSpline({
  className,
  variant = "howWorks",
  webGLContext = "marketing",
}: Props) {
  const config = ORBS_VARIANT_CONFIG[variant];

  const handleSplineLoad = useCallback((app: Application) => {
    configureMatchHowWorksSplineFraming(app);
  }, []);

  const shellStyle = {
    ["--match-how-spline-display-scale" as string]: String(config.displayScale),
    ["--match-how-spline-height-ratio" as string]: String(config.heightRatio),
    ["--match-how-spline-width-ratio" as string]: String(config.widthRatio),
    ["--match-how-spline-offset-x" as string]: config.offsetX,
    ["--match-how-spline-offset-y" as string]: config.offsetY,
  } as CSSProperties;

  const scenePanStyle = {
    transform: `translateX(${config.panX}) scale(${config.sceneScale})`,
    transformOrigin: "center center",
  } as CSSProperties;

  return (
    <div className={cn("match-orbs-spline", className)}>
      <div className="match-how-works-spline__shell" style={shellStyle}>
        <SplineInteractiveScene
          scene={MATCH_HOW_WORKS_SPLINE_SCENE}
          initialZoom={MATCH_HOW_WORKS_SPLINE_ZOOM}
          pointerFollow={false}
          renderOnDemand={false}
          webGLContext={webGLContext}
          className="match-how-works-spline__scene"
          style={scenePanStyle}
          onLoad={handleSplineLoad}
        />
      </div>
    </div>
  );
}
