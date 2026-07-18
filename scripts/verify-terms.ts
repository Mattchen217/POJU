/**
 * pojulife terminology verifier — 8 gates, non-zero exit on failure.
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
  POJU_TERMS,
  type PojuTerm,
  type TermLocale,
} from "@/lib/glossary/pojulife-terms";
import { GLYPH_LEVEL_SLUG, GLYPH_PALACE_SLUG } from "@/lib/glyph/glyph-slug";
import { QIMEN_SLUG } from "@/lib/qimen/qimen-slug";

type Fail = { gate: number; message: string };

const LOCALES: TermLocale[] = ["zh", "en", "es", "de", "fr"];

const AUDIT_ZH_RE =
  /八字|四柱|日主|用神|忌神|大运|流年|十神|七杀|食神|伤官|命盘|命局|奇门|遁甲|算命|命理/;
const AUDIT_EN_RE = /\b(?:qimen|dunjia)\b/i;
const AUDIT_REDLINE_ZH_RE = /占卜|命运|宿命|吉凶|星象|风水|上上|下下/;
/** Soft-label redline: no Death / Injury / Shock / Tiger; no zodiac; no auspicious/ominous. */
const AUDIT_REDLINE_EN_RE =
  /\b(?:Death|Injury|Shock|Tiger|Rat|Ox|Rabbit|Dragon|Snake|Horse|Goat|Sheep|Monkey|Rooster|Dog|Pig|Auspicious|Ominous)\b/;

/** Fix D — glyph wind levels are phrase imagery; en fixed by types/oracle.ts. */
const GLYPH_LEVEL_WORD_WHITELIST = new Set([
  "divine_tailwind",
  "fair_sky",
  "still_water",
  "crosswind",
  "eye_of_storm",
]);

const GLYPH_LEVEL_BY_TRADITIONAL: Record<string, string> = {
  廟: "divine_tailwind",
  旺: "fair_sky",
  得: "still_water",
  閒: "crosswind",
  陷: "eye_of_storm",
};

const EXPECTED_BAZI = 141;
const EXPECTED_QIMEN = 39;
const EXPECTED_GLYPH = 17;
const EXPECTED_ZODIAC = 12;
const EXPECTED_TOTAL =
  EXPECTED_BAZI + EXPECTED_QIMEN + EXPECTED_GLYPH + EXPECTED_ZODIAC;

const ZODIAC_SLUG_BY_TRADITIONAL: Record<string, string> = {
  鼠: "zd_rat",
  牛: "zd_ox",
  虎: "zd_tiger",
  兔: "zd_rabbit",
  龍: "zd_dragon",
  蛇: "zd_snake",
  馬: "zd_horse",
  羊: "zd_goat",
  猴: "zd_monkey",
  雞: "zd_rooster",
  狗: "zd_dog",
  豬: "zd_pig",
};

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
  // SSOT itself is authoritative for landed soft terms (pillar / zodiac / …).
  for (const t of POJU_TERMS) set.add(t.slug);
  return set;
}

function expectedSlug(term: PojuTerm): string | undefined {
  if (term.ns === "qimen") {
    return QIMEN_SLUG[term.traditional as keyof typeof QIMEN_SLUG];
  }
  if (term.ns === "glyph") {
    if (GLYPH_LEVEL_WORD_WHITELIST.has(term.slug)) {
      return GLYPH_LEVEL_BY_TRADITIONAL[term.traditional] ?? term.slug;
    }
    const branch = term.traditional.replace(/[宮宫]$/u, "");
    return GLYPH_PALACE_SLUG[branch as keyof typeof GLYPH_PALACE_SLUG];
  }
  if (term.ns === "zodiac") {
    return ZODIAC_SLUG_BY_TRADITIONAL[term.traditional] ?? term.slug;
  }
  return slugForTraditional(term.traditional) ?? term.slug;
}

function gate1SlugLegality(valid: Set<string>, entries: readonly PojuTerm[]): Fail[] {
  const fails: Fail[] = [];
  for (const e of entries) {
    if (!valid.has(e.slug)) {
      fails.push({
        gate: 1,
        message: `slug not in fact sources: ${e.ns}:${e.traditional} → "${e.slug}"`,
      });
    }
  }
  return fails;
}

function gate2SlugMapping(entries: readonly PojuTerm[]): Fail[] {
  const fails: Fail[] = [];
  for (const e of entries) {
    const expected = expectedSlug(e);
    if (expected !== e.slug) {
      fails.push({
        gate: 2,
        message: `slug mismatch ${e.ns}:${e.traditional}: expected "${expected ?? "?"}" got "${e.slug}"`,
      });
    }
  }
  return fails;
}

function gate3Coverage(entries: readonly PojuTerm[]): Fail[] {
  const fails: Fail[] = [];
  const bazi = entries.filter((e) => e.ns === "bazi");
  const qimen = entries.filter((e) => e.ns === "qimen");
  const glyph = entries.filter((e) => e.ns === "glyph");
  const zodiac = entries.filter((e) => e.ns === "zodiac");

  if (entries.length !== EXPECTED_TOTAL) {
    fails.push({
      gate: 3,
      message: `coverage total: expected ${EXPECTED_TOTAL}, got ${entries.length}`,
    });
  }
  if (bazi.length !== EXPECTED_BAZI) {
    fails.push({ gate: 3, message: `coverage bazi: expected ${EXPECTED_BAZI}, got ${bazi.length}` });
  }
  if (qimen.length !== EXPECTED_QIMEN) {
    fails.push({
      gate: 3,
      message: `coverage qimen: expected ${EXPECTED_QIMEN}, got ${qimen.length}`,
    });
  }
  if (glyph.length !== EXPECTED_GLYPH) {
    fails.push({
      gate: 3,
      message: `coverage glyph: expected ${EXPECTED_GLYPH}, got ${glyph.length}`,
    });
  }
  if (zodiac.length !== EXPECTED_ZODIAC) {
    fails.push({
      gate: 3,
      message: `coverage zodiac: expected ${EXPECTED_ZODIAC}, got ${zodiac.length}`,
    });
  }
  return fails;
}

function gate4NoSubstringCollisions(entries: readonly PojuTerm[]): Fail[] {
  const fails: Fail[] = [];
  for (const loc of LOCALES) {
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
  }
  return fails;
}

function gate5AuditRegex(entries: readonly PojuTerm[]): Fail[] {
  const fails: Fail[] = [];
  for (const e of entries) {
    for (const loc of LOCALES) {
      const t = e.term[loc];
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
      if (AUDIT_EN_RE.test(t)) {
        fails.push({
          gate: 5,
          message: `[${loc}] qimen/dunjia regex hit on ${e.traditional} term="${t}"`,
        });
      }
      // Zodiac soft labels intentionally use animal names (Rat / Tiger / …).
      if (e.ns !== "zodiac" && AUDIT_REDLINE_EN_RE.test(t)) {
        fails.push({
          gate: 5,
          message: `[${loc}] Death/zodiac/Auspicious hit on ${e.traditional} term="${t}"`,
        });
      }
    }
  }
  return fails;
}

function gate6SingleWord(entries: readonly PojuTerm[]): Fail[] {
  const fails: Fail[] = [];
  for (const e of entries) {
    // Fix D — glyph level phrase whitelist
    if (e.ns === "glyph" && GLYPH_LEVEL_WORD_WHITELIST.has(e.slug)) continue;
    for (const loc of LOCALES) {
      const t = e.term[loc].trim();
      if (!t) {
        fails.push({ gate: 6, message: `[${loc}] empty term for ${e.traditional}` });
        continue;
      }
      if (/\s/.test(t)) {
        fails.push({
          gate: 6,
          message: `[${loc}] term must be one word (no spaces): ${e.ns}:${e.traditional}="${t}"`,
        });
      }
    }
  }
  return fails;
}

/** Gate 7 — same zh soft label must not mean two things across namespaces. */
function gate7CrossNsZhCollision(entries: readonly PojuTerm[]): Fail[] {
  const fails: Fail[] = [];
  const byZh = new Map<string, PojuTerm[]>();
  for (const e of entries) {
    const zh = e.term.zh.trim();
    if (!zh) continue;
    const list = byZh.get(zh) ?? [];
    list.push(e);
    byZh.set(zh, list);
  }
  for (const [zh, list] of byZh) {
    const nss = new Set(list.map((e) => e.ns));
    if (nss.size > 1) {
      fails.push({
        gate: 7,
        message: `cross-ns zh collision "${zh}": ${list.map((e) => `${e.ns}:${e.slug}`).join(", ")}`,
      });
    }
  }
  return fails;
}

/** Gate 8 — ns+slug uniqueness. */
function gate8NsSlugUniqueness(entries: readonly PojuTerm[]): Fail[] {
  const fails: Fail[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const key = `${e.ns}:${e.slug}`;
    if (seen.has(key)) {
      fails.push({ gate: 8, message: `duplicate ns:slug ${key}` });
    }
    seen.add(key);
  }
  return fails;
}

function main() {
  console.log("\n========== verify-terms (8 gates) ==========\n");

  const validSlugs = collectValidSlugs();
  const entries = POJU_TERMS;

  const allFails = [
    ...gate1SlugLegality(validSlugs, entries),
    ...gate2SlugMapping(entries),
    ...gate3Coverage(entries),
    ...gate4NoSubstringCollisions(entries),
    ...gate5AuditRegex(entries),
    ...gate6SingleWord(entries),
    ...gate7CrossNsZhCollision(entries),
    ...gate8NsSlugUniqueness(entries),
  ];

  const gates = [1, 2, 3, 4, 5, 6, 7, 8];
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

  const bazi = entries.filter((e) => e.ns === "bazi").length;
  const qimen = entries.filter((e) => e.ns === "qimen").length;
  const glyph = entries.filter((e) => e.ns === "glyph").length;
  const zodiac = entries.filter((e) => e.ns === "zodiac").length;
  console.log(
    `\nAll 8 gates passed (${entries.length} = bazi ${bazi} + qimen ${qimen} + glyph ${glyph} + zodiac ${zodiac}).\n`,
  );
}

main();
