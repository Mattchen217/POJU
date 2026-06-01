import type { CurrentLevel } from "@/lib/syncro/current-system";

export type ArHaloColors = {
  border: string;
  glow1: string;
  glow2: string;
};

/** AR camera ring glow by Current level (Part 3). */
export function getArHaloColors(level?: CurrentLevel): ArHaloColors {
  switch (level) {
    case "open_current":
      return {
        border: "rgba(0, 217, 184, 0.7)",
        glow1: "rgba(0, 217, 184, 0.6)",
        glow2: "rgba(0, 217, 184, 0.3)",
      };
    case "following_current":
      return {
        border: "rgba(78, 205, 196, 0.6)",
        glow1: "rgba(78, 205, 196, 0.5)",
        glow2: "rgba(78, 205, 196, 0.25)",
      };
    case "stillwater":
      return {
        border: "rgba(138, 138, 160, 0.5)",
        glow1: "rgba(138, 138, 160, 0.3)",
        glow2: "rgba(138, 138, 160, 0.15)",
      };
    case "crosscurrent":
      return {
        border: "rgba(232, 159, 77, 0.6)",
        glow1: "rgba(232, 159, 77, 0.5)",
        glow2: "rgba(232, 159, 77, 0.25)",
      };
    case "undertow":
      return {
        border: "rgba(200, 90, 90, 0.6)",
        glow1: "rgba(200, 90, 90, 0.5)",
        glow2: "rgba(200, 90, 90, 0.25)",
      };
    default:
      return {
        border: "rgba(255, 255, 255, 0.15)",
        glow1: "rgba(255, 255, 255, 0.1)",
        glow2: "transparent",
      };
  }
}
