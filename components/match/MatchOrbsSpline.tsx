"use client";

import { useCallback, type CSSProperties } from "react";
import type { Application } from "@splinetool/runtime";

import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";
import { configureMatchHowWorksSplineFraming } from "@/lib/match/configure-match-how-works-spline-framing";
import {
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

type Props = {
  className?: string;
  webGLContext?: HeavyWebGLContext;
};

/** Red / green orbs Spline — shared by How Match works + analyzing wait. */
export function MatchOrbsSpline({ className, webGLContext = "marketing" }: Props) {
  const handleSplineLoad = useCallback((app: Application) => {
    configureMatchHowWorksSplineFraming(app);
  }, []);

  const shellStyle = {
    ["--match-how-spline-display-scale" as string]: String(MATCH_HOW_WORKS_SPLINE_DISPLAY_SCALE),
    ["--match-how-spline-height-ratio" as string]: String(MATCH_HOW_WORKS_SPLINE_SHELL_HEIGHT_RATIO),
    ["--match-how-spline-offset-x" as string]: MATCH_HOW_WORKS_SPLINE_SHELL_OFFSET_X,
    ["--match-how-spline-offset-y" as string]: MATCH_HOW_WORKS_SPLINE_SHELL_OFFSET_Y,
  } as CSSProperties;

  const scenePanStyle = {
    transform: `translateX(${MATCH_HOW_WORKS_SPLINE_SCENE_PAN_X}) scale(${MATCH_HOW_WORKS_SPLINE_SCENE_SCALE})`,
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
