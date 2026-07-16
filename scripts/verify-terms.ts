/**
 * pojulife terminology verifier — 6 gates, non-zero exit on failure.
 *
 *   pnpm run verify:terms
 *   npx tsx scripts/verify-terms.ts
 */

import {
  ALLOW_CONCEPT_SLUG,
  CLOSED_SET_SLUG,
  RELATION_SLUG,
  WUXING_SLUG,
  YINYANG_SLUG,
  slugForTraditional,
} from "@/lib/glossary/term-closed-set";
import {
  B1_BAZI_TRADITIONALS,
  POJULIFE_TERMS,
  type PojuTermEntry,
  type TermLocale,
} from "@/lib/glossary/pojulife-terms";
import { GLYPH_LEVEL_SLUG, GLYPH_PALACE_SLUG } from "@/lib/glyph/glyph-slug";
import { QIMEN_SLUG } from "@/lib/qimen/qimen-slug";

type Fail = { gate: number; message: string };

const LOCALES: TermLocale[] = ["zh", "en", "es", "de", "fr"];

const AUDIT_ZH_RE =
  /八字|四柱|日主|用神|忌神|大运|流年|十神|七杀|食神|伤官|命盘|命局|奇门|遁甲|算命|命理/;
const AUDIT_EN_RE = /\b(?:qimen|dunjia)\b/i;
const AUDIT_REDLINE_ZH_RE = /占卜|命运|宿命|吉凶|星象/;

function collectValidSlugs(): Set<string> {
  const set = new Set<string>();
  for (const v of Object.values(CLOSED_SET_SLUG)) set.add(v);
  for (const v of Object.values(WUXING_SLUG)) set.add(v);
  for (const v of Object.values(YINYANG_SLUG)) set.add(v);
  for (const v of Object.values(ALLOW_CONCEPT_SLUG)) set.add(v);
  for (const v of Object.values(RELATION_SLUG)) set.add(v);
  for (const v of Object.values(QIMEN_SLUG)) set.add(v);
  for (const v of Object.values(GLYPH_PALACE_SLUG)) set.add(v);
  for (const v of Object.values(GLYPH_LEVEL_SLUG)) set.add(v);
  return set;
}

function gate1SlugLegality(valid: Set<string>, entries: PojuTermEntry[]): Fail[] {
  const fails: Fail[] = [];
  for (const e of entries) {
    if (!valid.has(e.slug)) {
      fails.push({
        gate: 1,
        message: `slug not in fact sources: ${e.traditional} → "${e.slug}"`,
      });
    }
  }
  return fails;
}

function gate2SlugMapping(entries: PojuTermEntry[]): Fail[] {
  const fails: Fail[] = [];
  for (const e of entries) {
    const expected = slugForTraditional(e.traditional);
    if (expected !== e.slug) {
      fails.push({
        gate: 2,
        message: `slug mismatch ${e.traditional}: expected "${expected ?? "?"}" got "${e.slug}"`,
      });
    }
  }
  return fails;
}

function gate3Coverage(batch: readonly string[], entries: PojuTermEntry[]): Fail[] {
  const fails: Fail[] = [];
  const have = new Set(entries.map((e) => e.traditional));
  for (const t of batch) {
    if (!have.has(t)) {
      fails.push({ gate: 3, message: `missing B1 entry for traditional="${t}"` });
    }
  }
  for (const e of entries) {
    if (!batch.includes(e.traditional)) {
      fails.push({ gate: 3, message: `extra entry not in B1 batch: ${e.traditional}` });
    }
  }
  return fails;
}

function gate4NoSubstringCollisions(entries: PojuTermEntry[]): Fail[] {
  const fails: Fail[] = [];
  // Primary audit collisions are zh user-visible — latin single-word terms ship in later batches.
  const loc: TermLocale = "zh";
  const labels = entries.map((e) => ({
    traditional: e.traditional,
    label: e.term[loc].trim(),
    ns: e.ns,
  }));
  for (let i = 0; i < labels.length; i++) {
    for (let j = 0; j < labels.length; j++) {
      if (i === j) continue;
      const a = labels[i]!;
      const b = labels[j]!;
      if (a.ns !== b.ns) continue;
      if (a.label.length < 2 || b.label.length < 2) continue;
      if (b.label.includes(a.label) && a.label !== b.label) {
        fails.push({
          gate: 4,
          message: `[${loc}] substring collision: "${a.label}" ⊂ "${b.label}" (${a.traditional} vs ${b.traditional})`,
        });
      }
    }
  }
  return fails;
}

function gate5AuditRegex(entries: PojuTermEntry[]): Fail[] {
  const fails: Fail[] = [];
  for (const e of entries) {
    for (const loc of LOCALES) {
      const t = e.term[loc];
      if (loc === "zh" || loc === "es" || loc === "de" || loc === "fr") {
        if (AUDIT_ZH_RE.test(t)) {
          fails.push({
            gate: 5,
            message: `[${loc}] audit regex hit on ${e.traditional} term="${t}"`,
          });
        }
        if (AUDIT_REDLINE_ZH_RE.test(t)) {
          fails.push({
            gate: 5,
            message: `[${loc}] redline regex hit on ${e.traditional} term="${t}"`,
          });
        }
      }
      if (AUDIT_EN_RE.test(t)) {
        fails.push({
          gate: 5,
          message: `[${loc}] qimen/dunjia regex hit on ${e.traditional} term="${t}"`,
        });
      }
    }
  }
  return fails;
}

function gate6SingleWord(entries: PojuTermEntry[]): Fail[] {
  const fails: Fail[] = [];
  // zh soft labels are user-audited — must be compact single tokens (no spaces).
  // Latin locales: multi-word glossary seeds are interim until collaborator B1 delivery.
  for (const e of entries) {
    const t = e.term.zh.trim();
    if (!t) {
      fails.push({ gate: 6, message: `[zh] empty term for ${e.traditional}` });
      continue;
    }
    if (/\s/.test(t)) {
      fails.push({
        gate: 6,
        message: `[zh] term must be one word (no spaces): ${e.traditional}="${t}"`,
      });
    }
  }
  return fails;
}

function main() {
  console.log("\n========== verify-terms (6 gates) ==========\n");

  const validSlugs = collectValidSlugs();
  const b1 = POJULIFE_TERMS.filter((e) => B1_BAZI_TRADITIONALS.includes(e.traditional));

  const allFails = [
    ...gate1SlugLegality(validSlugs, b1),
    ...gate2SlugMapping(b1),
    ...gate3Coverage(B1_BAZI_TRADITIONALS, b1),
    ...gate4NoSubstringCollisions(b1),
    ...gate5AuditRegex(b1),
    ...gate6SingleWord(b1),
  ];

  const gates = [1, 2, 3, 4, 5, 6];
  for (const g of gates) {
    const n = allFails.filter((f) => f.gate === g).length;
    console.log(`Gate ${g}: ${n === 0 ? "PASS" : `FAIL (${n})`}`);
  }

  if (allFails.length) {
    console.error("\nFailures:");
    for (const f of allFails) {
      console.error(`  [gate ${f.gate}] ${f.message}`);
    }
    console.error(`\n${allFails.length} failure(s) — verify-terms FAILED\n`);
    process.exit(1);
  }

  console.log(`\nAll 6 gates passed for B1 (${b1.length} terms).\n`);
}

main();
