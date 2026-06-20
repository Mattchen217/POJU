import type { SignData } from "@/types/oracle";

export type GlyphWindAccent = {
  wind: string;
  soft: string;
  glow: string;
};

const WIND_BY_LEVEL: Record<SignData["level"], GlyphWindAccent> = {
  eye_of_storm: { wind: "#ff5d72", soft: "#ff96a5", glow: "rgba(255, 93, 114, 0.55)" },
  crosswind: { wind: "#f0a850", soft: "#fbbf6b", glow: "rgba(240, 170, 80, 0.5)" },
  still_water: { wind: "#8fd6d2", soft: "#9af0e2", glow: "rgba(143, 214, 210, 0.5)" },
  fair_sky: { wind: "#7dd3fc", soft: "#bae6fd", glow: "rgba(125, 211, 252, 0.5)" },
  divine_tailwind: { wind: "#f0c674", soft: "#f7e0a8", glow: "rgba(240, 198, 116, 0.5)" },
};

export function glyphWindAccentForLevel(level: SignData["level"]): GlyphWindAccent {
  return WIND_BY_LEVEL[level] ?? WIND_BY_LEVEL.eye_of_storm;
}

export function glyphWindAccentStyle(level: SignData["level"]): Record<string, string> {
  const a = glyphWindAccentForLevel(level);
  return {
    "--wind": a.wind,
    "--wind-soft": a.soft,
    "--wind-glow": a.glow,
  };
}
