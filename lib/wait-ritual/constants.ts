import { ACTIVITY_CAPTION_ROTATE_MS } from "@/lib/ui/activity-caption-timing";
import { PREPARING_ANALYZING_SCENE } from "@/components/poju/PreparingAnalyzingSpline";

export type DeliveryWaitProduct = "glyph" | "match" | "syncro" | "poju";

export type DeliveryWaitVisualPhase = "bazi" | "bridge" | "product" | "finishing" | "converge" | "exit";

export const DELIVERY_WAIT_SCENES = {
  bazi: PREPARING_ANALYZING_SCENE,
  glyph: "/spline/glyphdongxiao.splinecode",
  match: "/spline/matchdongxiao.splinecode",
  syncro: "/spline/syncrodongxiao.splinecode",
} as const;

export const DELIVERY_WAIT_GLOW: Record<DeliveryWaitProduct | "bazi", string> = {
  bazi: "#8AB4FF",
  poju: "#8AB4FF",
  glyph: "#C9A24B",
  match: "#B488F0",
  syncro: "#5AD8C8",
};

export const WAIT_BRIDGE_HOLD_MS = 2500;
export const WAIT_FINISH_COPY_MS = 600;
export const WAIT_CONVERGE_MS = 900;
export const WAIT_CROSSFADE_MS = 700;
export const WAIT_FLASH_MS = 300;
export const WAIT_BAZI_CACHED_MIN_MS = 10_000;
export const WAIT_STEP_INTERVAL_MS = ACTIVITY_CAPTION_ROTATE_MS;

/** Non-zh finalize theater: show artifact ④ + convert copy. */
export const WAIT_SEMANTIC_ARTIFACT_MS = 60_000;
/** Non-zh finalize theater: switch to final-audit copy. */
export const WAIT_FINAL_AUDIT_MS = 120_000;
/** A4 center hold before flying to left 2×2 slot. */
export const WAIT_ARTIFACT_CENTER_HOLD_MS = 5000;
/** Spawn scale-up + seat flight (must cover CSS transitions). */
export const WAIT_ARTIFACT_SPAWN_MS = 400;
export const WAIT_ARTIFACT_SEAT_MS = 850;
/** Full intro ritual before tearing down wait UI after a late artifact. */
export const WAIT_ARTIFACT_INTRO_TOTAL_MS =
  WAIT_ARTIFACT_SPAWN_MS + WAIT_ARTIFACT_CENTER_HOLD_MS + WAIT_ARTIFACT_SEAT_MS;

export function productScene(product: DeliveryWaitProduct): string {
  if (product === "poju") return DELIVERY_WAIT_SCENES.bazi;
  return DELIVERY_WAIT_SCENES[product];
}

export function glowForPhase(product: DeliveryWaitProduct, phase: DeliveryWaitVisualPhase): string {
  if (phase === "bazi" || phase === "bridge" || product === "poju") {
    return DELIVERY_WAIT_GLOW.bazi;
  }
  return DELIVERY_WAIT_GLOW[product];
}
