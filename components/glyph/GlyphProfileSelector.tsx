"use client";

/**
 * Glyph v5 — profile picker shell (Step 3).
 * Step 3 will wire `SessionPreparation` + `productType="glyph"`.
 * Until then, re-export POJU `ProfileSelector` for shared birth-info UX.
 */

export { ProfileSelector as GlyphProfileSelector } from "@/components/profile/ProfileSelector";
export type { ProfileSelectorProps as GlyphProfileSelectorProps } from "@/components/profile/ProfileSelector";
