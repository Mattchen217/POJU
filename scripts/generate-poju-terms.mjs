/**
 * Parse docs/完整重命名清单（157）.json (JS-like), apply Fix A/B/C, emit lib/glossary/pojulife-terms.ts
 * (155 = bazi 99 + qimen 39 + glyph 17). Fix D (glyph level word-check whitelist) lives in verify-terms.
 *
 *   node scripts/generate-poju-terms.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOC = path.join(ROOT, "docs", "完整重命名清单（157）.json");
const OUT = path.join(ROOT, "lib", "glossary", "pojulife-terms.ts");

/** Slug remaps required for code fact sources (Fix A + relation/qimen mismatches). */
const SLUG_REMAP = {
  tg_jia: "stem_jia",
  tg_yi: "stem_yi",
  tg_bing: "stem_bing",
  tg_ding: "stem_ding",
  tg_wu: "stem_wu",
  tg_ji: "stem_ji",
  tg_geng: "stem_geng",
  tg_xin: "stem_xin",
  tg_ren: "stem_ren",
  tg_gui: "stem_gui",
  dz_zi: "branch_zi",
  dz_chou: "branch_chou",
  dz_yin: "branch_yin",
  dz_mao: "branch_mao",
  dz_chen: "branch_chen",
  dz_si: "branch_si",
  dz_wu: "branch_wu",
  dz_wei: "branch_wei",
  dz_shen: "branch_shen",
  dz_you: "branch_you",
  dz_xu: "branch_xu",
  dz_hai: "branch_hai",
  liu_he: "liuhe",
  san_he: "sanhe",
  clash: "chong",
  punishment: "xing",
  harm: "hai",
  half_combination: "banhe",
  stem_combination: "stemhe",
  qm_dun_yang: "qm_yang_dun",
  qm_dun_yin: "qm_yin_dun",
  qm_yuan_upper: "qm_yuan_shang",
  qm_yuan_middle: "qm_yuan_zhong",
  qm_yuan_lower: "qm_yuan_xia",
};

const TRAD_REMAP = {
  阳遁: "陽遁",
  阴遁: "陰遁",
};

/** Fix C — cross-ns zh collisions: change non-bazi side (bazi keeps first meaning). */
const ZH_REMAP_BY_SLUG = {
  gp_mao: "蔓展", // was 舒展 (= bazi 木)
  gp_you: "精锻", // was 淬炼 (= bazi 七杀)
  qm_tian_ren: "承稳", // was 承托 (= bazi 土)
};

function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (src[i] === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (src[i] === '"' || src[i] === "'" || src[i] === "`") {
      const q = src[i];
      out += src[i++];
      while (i < src.length) {
        if (src[i] === "\\") {
          out += src[i++];
          if (i < src.length) out += src[i++];
          continue;
        }
        out += src[i];
        if (src[i] === q) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    out += src[i++];
  }
  return out;
}

function extractArrays(src) {
  const clean = stripComments(src);
  const arrays = [];
  const re = /(?:export\s+)?const\s+(\w+)\s*=\s*\[/g;
  let m;
  while ((m = re.exec(clean))) {
    const name = m[1];
    const start = m.index + m[0].length - 1;
    let depth = 0;
    let i = start;
    for (; i < clean.length; i++) {
      const ch = clean[i];
      if (ch === '"' || ch === "'" || ch === "`") {
        const q = ch;
        i++;
        while (i < clean.length) {
          if (clean[i] === "\\") {
            i += 2;
            continue;
          }
          if (clean[i] === q) break;
          i++;
        }
        continue;
      }
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    const body = clean.slice(start, i);
    const jsonish = body
      .replace(/([{\[,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, "$1");
    let arr;
    try {
      arr = JSON.parse(jsonish);
    } catch (e) {
      throw new Error(`Failed to parse array ${name}: ${e.message}`);
    }
    arrays.push({ name, entries: arr });
  }
  return arrays;
}

function applyFixes(entry) {
  const e = structuredClone(entry);
  if (TRAD_REMAP[e.traditional]) e.traditional = TRAD_REMAP[e.traditional];
  if (SLUG_REMAP[e.slug]) e.slug = SLUG_REMAP[e.slug];
  // Fix B
  if (e.traditional === "金舆") e.term.de = "Wagen";
  // Fix C — cross-ns zh: remap non-bazi side
  if (ZH_REMAP_BY_SLUG[e.slug]) {
    e.term.zh = ZH_REMAP_BY_SLUG[e.slug];
  }
  return e;
}

function findSubstringCollisions(entries, locale) {
  const hits = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = 0; j < entries.length; j++) {
      if (i === j) continue;
      const a = entries[i];
      const b = entries[j];
      if (a.ns !== b.ns) continue;
      const la = (a.term[locale] || "").trim();
      const lb = (b.term[locale] || "").trim();
      if (la.length < 2 || lb.length < 2) continue;
      if (lb.includes(la) && la !== lb) {
        hits.push({ locale, a: `${a.traditional}:${la}`, b: `${b.traditional}:${lb}` });
      }
    }
  }
  return hits;
}

function findCrossNsZhCollisions(entries) {
  const byZh = new Map();
  for (const e of entries) {
    const zh = (e.term.zh || "").trim();
    if (!zh) continue;
    if (!byZh.has(zh)) byZh.set(zh, []);
    byZh.get(zh).push(e);
  }
  const hits = [];
  for (const [zh, list] of byZh) {
    const nss = new Set(list.map((e) => e.ns));
    if (nss.size > 1) {
      hits.push({
        zh,
        entries: list.map((e) => `${e.ns}:${e.slug}`),
      });
    }
  }
  return hits;
}

function esc(s) {
  return JSON.stringify(s ?? "");
}

function emitTs(entries) {
  const lines = [];
  lines.push(`/**`);
  lines.push(` * pojulife terminology — single source of truth (SSOT).`);
  lines.push(` * Generated from docs/完整重命名清单（157）.json with Fix A/B/C applied.`);
  lines.push(` * 155 = bazi 99 + qimen 39 + glyph 17. Do not parallel-maintain soft labels elsewhere.`);
  lines.push(` *`);
  lines.push(` * Regenerate: node scripts/generate-poju-terms.mjs`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`export type TermNs = "bazi" | "qimen" | "glyph";`);
  lines.push(`export type TermPolarity = "favorable" | "caution" | "neutral";`);
  lines.push(`export type TermLocale = "zh" | "en" | "es" | "de" | "fr";`);
  lines.push(``);
  lines.push(`export interface PojuTerm {`);
  lines.push(`  ns: TermNs;`);
  lines.push(`  slug: string;`);
  lines.push(`  /** Internal traditional han — never user-facing output. */`);
  lines.push(`  traditional: string;`);
  lines.push(`  polarity: TermPolarity;`);
  lines.push(`  term: Record<TermLocale, string>;`);
  lines.push(`  definition: Record<TermLocale, string>;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export const POJU_TERMS: readonly PojuTerm[] = [`);
  for (const e of entries) {
    lines.push(`  {`);
    lines.push(`    ns: ${esc(e.ns)},`);
    lines.push(`    slug: ${esc(e.slug)},`);
    lines.push(`    traditional: ${esc(e.traditional)},`);
    lines.push(`    polarity: ${esc(e.polarity)},`);
    lines.push(`    term: {`);
    lines.push(`      zh: ${esc(e.term.zh)},`);
    lines.push(`      en: ${esc(e.term.en)},`);
    lines.push(`      es: ${esc(e.term.es)},`);
    lines.push(`      de: ${esc(e.term.de)},`);
    lines.push(`      fr: ${esc(e.term.fr)},`);
    lines.push(`    },`);
    lines.push(`    definition: {`);
    lines.push(`      zh: ${esc(e.definition.zh)},`);
    lines.push(`      en: ${esc(e.definition.en)},`);
    lines.push(`      es: ${esc(e.definition.es)},`);
    lines.push(`      de: ${esc(e.definition.de)},`);
    lines.push(`      fr: ${esc(e.definition.fr)},`);
    lines.push(`    },`);
    lines.push(`  },`);
  }
  lines.push(`];`);
  lines.push(``);
  lines.push(`/** ns-isolated lookup key: \`\${ns}:\${slug}\`. */`);
  lines.push(`export const TERM_BY_KEY = new Map(
  POJU_TERMS.map((t) => [\`\${t.ns}:\${t.slug}\`, t] as const),
);

/** @deprecated Use TERM_BY_KEY */
export const TERM_BY_SLUG = TERM_BY_KEY;

export const TERM_BY_TRADITIONAL = new Map(
  POJU_TERMS.map((t) => [\`\${t.ns}:\${t.traditional}\`, t] as const),
);

const LOCALE_FALLBACK: TermLocale[] = ["en", "zh"];

export function toTermLocale(locale: string): TermLocale {
  const base = (locale || "en").toLowerCase().split(/[-_]/)[0]!;
  if (base === "zh" || base === "en" || base === "es" || base === "de" || base === "fr") {
    return base;
  }
  return "en";
}

function pickLocale(bag: Record<TermLocale, string>, locale: string): string {
  const loc = toTermLocale(locale);
  const direct = (bag[loc] || "").trim();
  if (direct) return direct;
  for (const fb of LOCALE_FALLBACK) {
    const v = (bag[fb] || "").trim();
    if (v) return v;
  }
  return "";
}

export function termOf(ns: TermNs, slug: string, locale: string): string | null {
  const t = TERM_BY_KEY.get(\`\${ns}:\${slug}\`);
  if (!t) return null;
  const v = pickLocale(t.term, locale);
  return v || null;
}

export function glossOf(ns: TermNs, slug: string, locale: string): string | null {
  const t = TERM_BY_KEY.get(\`\${ns}:\${slug}\`);
  if (!t) return null;
  const v = pickLocale(t.definition, locale);
  return v || null;
}

/** Lookup by slug alone (slugs are unique across landed namespaces). */
export function pojuTermBySlug(slug: string): PojuTerm | undefined {
  return POJU_TERMS.find((t) => t.slug === slug);
}

export function pojuTermByTraditional(
  traditional: string,
  ns?: TermNs,
): PojuTerm | undefined {
  if (ns) return TERM_BY_TRADITIONAL.get(\`\${ns}:\${traditional}\`);
  return POJU_TERMS.find((t) => t.traditional === traditional);
}

/** Soft-label inject block for product prompts (available slug + 5-locale terms). */
export function buildPojuTermsPromptTable(locale: string, namespaces?: TermNs[]): string {
  const loc = toTermLocale(locale);
  const nsFilter = namespaces?.length ? new Set(namespaces) : null;
  const rows = POJU_TERMS.filter((t) => !nsFilter || nsFilter.has(t.ns))
    .map((t) => {
      const soft = pickLocale(t.term, loc);
      return \`| \\\`\${t.slug}\\\` | \${t.ns} | **\${soft}** |\`;
    })
    .join("\\n");
  return rows;
}

/** @deprecated Use POJU_TERMS */
export const POJULIFE_TERMS = POJU_TERMS;
`);
  return lines.join("\n");
}

function rewriteDoc(src) {
  let out = src;
  for (const [from, to] of Object.entries(SLUG_REMAP)) {
    out = out.replaceAll(`slug: "${from}"`, `slug: "${to}"`);
  }
  for (const [from, to] of Object.entries(TRAD_REMAP)) {
    out = out.replaceAll(`traditional: "${from}"`, `traditional: "${to}"`);
  }
  // Fix B
  out = out.replace(
    /(traditional:\s*"金舆"[\s\S]*?term:\s*\{[^}]*de:\s*)"Gefährt"/,
    '$1"Wagen"',
  );
  // Fix C — cross-ns zh
  out = out.replace(
    /(slug:\s*"gp_mao"[\s\S]*?term:\s*\{[^}]*zh:\s*)"舒展"/,
    '$1"蔓展"',
  );
  out = out.replace(
    /(slug:\s*"gp_you"[\s\S]*?term:\s*\{[^}]*zh:\s*)"淬炼"/,
    '$1"精锻"',
  );
  out = out.replace(
    /(slug:\s*"qm_tian_ren"[\s\S]*?term:\s*\{[^}]*zh:\s*)"承托"/,
    '$1"承稳"',
  );
  // Refresh landing banner
  out = out.replace(/^\/\/ LANDING_138.*\n/gm, "");
  out = out.replace(/^\/\/ Slugs aligned.*\n/gm, "");
  out = out.replace(/^\/\/ Fix B:.*\n/gm, "");
  out = out.replace(/^\/\/ GLYPH_PENDING_REDO.*\n/gm, "");
  if (!out.includes("LANDING_155")) {
    out =
      `// LANDING_155 — bazi 99 + qimen 39 + glyph 17 全量落地。\n` +
      `// Fix A: stem_*/branch_*/liuhe/sanhe；Fix B: 金舆 de Wagen；\n` +
      `// Fix C: 跨 ns 中文撞名 — glyph 卯/酉→蔓展/精锻，qimen 天任→承稳。\n` +
      `// Fix D: glyph level 单词检查白名单（en 由代码固定）。\n` +
      out;
  }
  return out;
}

function main() {
  const src = fs.readFileSync(DOC, "utf8");
  const arrays = extractArrays(src);
  const landed = arrays.flatMap((a) => a.entries.map(applyFixes));

  const byNs = { bazi: 0, qimen: 0, glyph: 0 };
  for (const e of landed) byNs[e.ns] = (byNs[e.ns] || 0) + 1;
  console.log("Parsed:", landed.length, byNs);

  if (landed.length !== 155) {
    console.error(`Expected 155, got ${landed.length}`);
    process.exit(1);
  }
  if (byNs.bazi !== 99 || byNs.qimen !== 39 || byNs.glyph !== 17) {
    console.error(`Expected 99/39/17, got ${byNs.bazi}/${byNs.qimen}/${byNs.glyph}`);
    process.exit(1);
  }

  for (const loc of ["zh", "en", "es", "de", "fr"]) {
    const hits = findSubstringCollisions(landed, loc);
    if (hits.length) {
      console.error(`Substring collisions [${loc}]:`, hits.slice(0, 10));
      process.exit(1);
    }
  }
  console.log("Same-ns substring scan: 0 hits");

  const cross = findCrossNsZhCollisions(landed);
  if (cross.length) {
    console.error("Cross-ns zh collisions:", cross);
    process.exit(1);
  }
  console.log("Cross-ns zh scan: 0 hits");

  fs.writeFileSync(OUT, emitTs(landed) + "\n", "utf8");
  console.log("Wrote", OUT);

  fs.writeFileSync(DOC, rewriteDoc(src), "utf8");
  console.log("Updated", DOC);
}

main();
