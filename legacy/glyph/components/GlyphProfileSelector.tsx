"use client";

/**
 * Glyph v5 — profile picker shell (Step 3).
 * Glyph prepare uses `SessionPreparation` with `productType="glyph"` directly.
 * Until then, re-export POJU `ProfileSelector` for shared birth-info UX.
 */

export { ProfileSelector as GlyphProfileSelector } from "@/components/profile/ProfileSelector";
export type { ProfileSelectorProps as GlyphProfileSelectorProps } from "@/components/profile/ProfileSelector";
