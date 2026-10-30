/**
 * LEGACY GENERATOR — DISABLED (Phase 0).
 *
 * This script previously rebuilt lib/glossary/pojulife-terms.ts from
 * docs/完整重命名清单（157）.json with hard-coded 155 = bazi 99 + qimen 39 + glyph 17.
 * The live SSOT is 260 = bazi 183 + qimen 48 + glyph 17 + zodiac 12 and includes
 * aliases / zodiac that this generator cannot reproduce. Running it would overwrite
 * the current SSOT with an outdated lexicon.
 *
 * Canonical source (Phase 0): lib/glossary/pojulife-terms.ts
 * Safe entry: pnpm terms:check | pnpm terms:generate -- --check | pnpm terms:generate -- --write
 *
 *   node scripts/generate-poju-terms.mjs
 */

console.error(
  [
    "",
    "legacy generator disabled; do not overwrite SSOT",
    "",
    "Reason: docs/完整重命名清单（157）.json targets 155 terms and omits zodiac/aliases.",
    "Live SSOT is lib/glossary/pojulife-terms.ts (260 terms). Do not reverse-generate from this script.",
    "",
    "Use:",
    "  pnpm terms:check",
    "  pnpm terms:generate -- --check",
    "  pnpm terms:generate -- --write --from <approved-terms.json>",
    "",
  ].join("\n"),
);
process.exit(1);
