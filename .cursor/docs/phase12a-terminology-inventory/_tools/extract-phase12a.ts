/**
 * Phase 12-A inventory extractor — READ ONLY against business code.
 * Writes JSON/MD/CSV under .cursor/docs/phase12a-terminology-inventory/
 *
 * Run: pnpm exec tsx .cursor/docs/phase12a-terminology-inventory/_tools/extract-phase12a.ts
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { POJU_TERMS, type PojuTerm } from "@/lib/glossary/pojulife-terms";
import { TERM_NS_ALL, TERM_NS_AVAILABILITY, type TermNs } from "@/lib/glossary/term-ns";
import { TERM_FORBIDDEN_REGISTRY } from "@/lib/glossary/term-forbidden-registry";
import {
  CLOSED_EARTHLY_BRANCHES,
  CLOSED_HEAVENLY_STEMS,
  CLOSED_LIFE_STAGES,
  CLOSED_SHEN_SHA,
  CLOSED_STRUCTURAL,
  CLOSED_TEN_GODS,
  CLOSED_WUXING,
  CLOSED_YINYANG,
  RELATION_SLUG,
} from "@/lib/glossary/term-closed-set";
import { resolvePojuTerm } from "@/lib/glossary/term-resolve";
import {
  ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS,
  ZIWEI_RUNTIME_PALACES,
  ZIWEI_RUNTIME_STARS,
  ziweiTokenDisposition,
} from "@/lib/ziwei/token-disposition";
import { resolveShenshaDisposition } from "@/lib/glossary/shensha-disposition";
import { 八神序, 九星序, 八門序, 宮位飛星序, 三奇六儀序, 天干序, 地支序 } from "@/lib/qimen/dictionary";

const ROOT = process.cwd();
const OUT = join(ROOT, ".cursor/docs/phase12a-terminology-inventory");

function sha(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim();
  } catch {
    return "unknown";
  }
}
function branch(): string {
  try {
    return execSync("git branch --show-current", { cwd: ROOT }).toString().trim();
  } catch {
    return "unknown";
  }
}

function write(name: string, content: string | object) {
  const p = join(OUT, name);
  const body = typeof content === "string" ? content : JSON.stringify(content, null, 2) + "\n";
  writeFileSync(p, body, "utf8");
  console.log("wrote", name, typeof content === "string" ? body.length : "json");
}

type LocalTerm = {
  namespace: string;
  traditional: string;
  source_file: string;
  source_symbol: string;
  source_line: number | null;
  value_type: string;
  output_field: string | null;
  current_slug: string | null;
  current_disposition: string | null;
  coverage_status: string;
  notes: string;
};

function lookupSsot(traditional: string, ns: TermNs | null): {
  slug: string | null;
  status: string;
  term?: PojuTerm;
} {
  if (ns) {
    const r = resolvePojuTerm(traditional, { namespace: ns });
    if (r.status === "resolved") return { slug: r.term.slug, status: "resolved", term: r.term };
    if (r.status === "forbidden") return { slug: null, status: "forbidden" };
    if (r.status === "ambiguous") return { slug: null, status: "ambiguous" };
    return { slug: null, status: "unknown" };
  }
  // try each ns
  const hits: string[] = [];
  for (const n of TERM_NS_ALL) {
    const r = resolvePojuTerm(traditional, { namespace: n });
    if (r.status === "resolved") hits.push(`${n}:${r.term.slug}`);
  }
  if (hits.length > 1) return { slug: null, status: `ambiguous_cross:${hits.join("|")}` };
  if (hits.length === 1) {
    const [nsHit, slug] = hits[0]!.split(":");
    return { slug: slug!, status: `resolved_via_${nsHit}` };
  }
  return { slug: null, status: "missing" };
}

function coverageOf(
  traditional: string,
  ns: TermNs | "engine" | "shared",
  dispositionHint?: string | null,
): string {
  const nsTry = ns === "engine" || ns === "shared" ? null : ns;
  const hit = lookupSsot(traditional, nsTry);
  if (dispositionHint === "redline" || dispositionHint === "blocked") return "blocked";
  if (dispositionHint === "internal_only") return "internal_only";
  if (hit.status === "ambiguous" || hit.status.startsWith("ambiguous")) return "ambiguous";
  if (hit.status === "forbidden") return "blocked";
  if (hit.slug) {
    const t = hit.term;
    if (!t) return "mapped_complete";
    const locs = ["zh", "en", "es", "de", "fr"] as const;
    const incomplete = locs.some((l) => !t.term[l]?.trim() || !t.definition[l]?.trim());
    return incomplete ? "mapped_incomplete" : "mapped_complete";
  }
  return "missing";
}

function pushTerm(
  list: LocalTerm[],
  seen: Set<string>,
  row: Omit<LocalTerm, "coverage_status" | "current_slug" | "current_disposition"> & {
    nsForLookup?: TermNs | null;
    dispositionHint?: string | null;
  },
) {
  const key = `${row.namespace}::${row.traditional}::${row.source_file}::${row.source_symbol}`;
  if (seen.has(key)) return;
  seen.add(key);
  const nsLookup = row.nsForLookup ?? (TERM_NS_ALL.includes(row.namespace as TermNs) ? (row.namespace as TermNs) : null);
  const hit = lookupSsot(row.traditional, nsLookup);
  let disposition = row.dispositionHint ?? null;
  if (!disposition && nsLookup === "ziwei") {
    disposition = ziweiTokenDisposition(row.traditional).status;
  }
  if (!disposition && nsLookup === "bazi") {
    try {
      const d = resolveShenshaDisposition(row.traditional);
      disposition = d.status;
    } catch {
      /* not shensha */
    }
  }
  list.push({
    namespace: row.namespace,
    traditional: row.traditional,
    source_file: row.source_file,
    source_symbol: row.source_symbol,
    source_line: row.source_line,
    value_type: row.value_type,
    output_field: row.output_field,
    current_slug: hit.slug,
    current_disposition: disposition ?? hit.status,
    coverage_status: coverageOf(row.traditional, (nsLookup ?? "shared") as TermNs | "shared", disposition),
    notes: row.notes,
  });
}

// --- collect local terms from known closed sets ---
const localTerms: LocalTerm[] = [];
const seen = new Set<string>();

function addClosed(
  ns: string,
  items: readonly string[],
  file: string,
  symbol: string,
  value_type: string,
  nsForLookup: TermNs | null,
  notes = "",
) {
  for (const t of items) {
    pushTerm(localTerms, seen, {
      namespace: ns,
      traditional: t,
      source_file: file,
      source_symbol: symbol,
      source_line: null,
      value_type,
      output_field: null,
      notes,
      nsForLookup,
    });
  }
}

addClosed("bazi", CLOSED_TEN_GODS, "lib/glossary/term-closed-set.ts", "CLOSED_TEN_GODS", "enum_closed", "bazi");
addClosed("bazi", CLOSED_SHEN_SHA, "lib/glossary/term-closed-set.ts", "CLOSED_SHEN_SHA", "enum_closed", "bazi");
addClosed("bazi", CLOSED_LIFE_STAGES as unknown as string[], "lib/glossary/term-closed-set.ts", "CLOSED_LIFE_STAGES", "enum_closed", "bazi", "长生十二宫");
addClosed("bazi", CLOSED_STRUCTURAL, "lib/glossary/term-closed-set.ts", "CLOSED_STRUCTURAL", "enum_closed", "bazi");
addClosed("shared", CLOSED_WUXING, "lib/glossary/term-closed-set.ts", "CLOSED_WUXING", "enum_closed", "bazi");
addClosed("shared", CLOSED_YINYANG, "lib/glossary/term-closed-set.ts", "CLOSED_YINYANG", "enum_closed", "bazi");
addClosed("shared", CLOSED_HEAVENLY_STEMS as unknown as string[], "lib/glossary/term-closed-set.ts", "CLOSED_HEAVENLY_STEMS", "enum_closed", "bazi");
addClosed("shared", CLOSED_EARTHLY_BRANCHES as unknown as string[], "lib/glossary/term-closed-set.ts", "CLOSED_EARTHLY_BRANCHES", "enum_closed", "bazi");
addClosed("bazi", Object.keys(RELATION_SLUG), "lib/glossary/term-closed-set.ts", "RELATION_SLUG", "relation_enum", "bazi");

addClosed("ziwei", ZIWEI_RUNTIME_PALACES as unknown as string[], "lib/ziwei/token-disposition.ts", "ZIWEI_RUNTIME_PALACES", "runtime_const", "ziwei");
addClosed("ziwei", ZIWEI_RUNTIME_STARS as unknown as string[], "lib/ziwei/token-disposition.ts", "ZIWEI_RUNTIME_STARS", "runtime_const", "ziwei");
addClosed(
  "ziwei",
  ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS as unknown as string[],
  "lib/ziwei/token-disposition.ts",
  "ZIWEI_RUNTIME_FIVE_ELEMENTS_CLASS",
  "runtime_const",
  "ziwei",
);

{
  const patternsPath = join(ROOT, "lib/ziwei/doushu/patterns.ts");
  const patternsSrc = readFileSync(patternsPath, "utf8");
  const nameRe = /name:\s*['"]([^'"]+)['"]/g;
  let nm: RegExpExecArray | null;
  while ((nm = nameRe.exec(patternsSrc))) {
    const line = patternsSrc.slice(0, nm.index).split("\n").length;
    pushTerm(localTerms, seen, {
      namespace: "ziwei",
      traditional: nm[1]!,
      source_file: "lib/ziwei/doushu/patterns.ts",
      source_symbol: "detectPatterns/pattern.name",
      source_line: line,
      value_type: "pattern_library",
      output_field: "ZiweiFactPack.patternHits[].name",
      notes: "Classical pattern name — Phase 10 isolates from user Prompt via hit_id; not in public SSOT by design",
      nsForLookup: "ziwei",
      dispositionHint: "internal_only",
    });
  }
  // Aux star names referenced in pattern helpers
  for (const trad of ["擎羊", "陀罗", "火星", "铃星", "地空", "地劫", "天魁", "天钺"]) {
    pushTerm(localTerms, seen, {
      namespace: "ziwei",
      traditional: trad,
      source_file: "lib/ziwei/doushu/patterns.ts",
      source_symbol: "SHA_NAMES/KUI_YUE consts",
      source_line: null,
      value_type: "runtime_const",
      output_field: "iztro adjective/minor stars (may appear in engine; not all in FactPack majorStars)",
      notes: "Referenced in pattern detection; FactPack majorStars list may omit some",
      nsForLookup: "ziwei",
      dispositionHint: "internal_only",
    });
  }
}

addClosed("qimen", 八神序 as unknown as string[], "lib/qimen/dictionary.ts", "八神序", "enum_closed", "qimen");
addClosed("qimen", 九星序 as unknown as string[], "lib/qimen/dictionary.ts", "九星序", "enum_closed", "qimen");
addClosed("qimen", 八門序 as unknown as string[], "lib/qimen/dictionary.ts", "八門序", "enum_closed", "qimen");
addClosed("qimen", 宮位飛星序 as unknown as string[], "lib/qimen/dictionary.ts", "宮位飛星序", "enum_closed", "qimen");
addClosed("qimen", 三奇六儀序 as unknown as string[], "lib/qimen/dictionary.ts", "三奇六儀序", "enum_closed", "qimen");
addClosed("qimen", 天干序 as unknown as string[], "lib/qimen/dictionary.ts", "天干序", "enum_closed", "qimen");
addClosed("qimen", 地支序 as unknown as string[], "lib/qimen/dictionary.ts", "地支序", "enum_closed", "qimen");

for (const f of TERM_FORBIDDEN_REGISTRY) {
  pushTerm(localTerms, seen, {
    namespace: f.namespace,
    traditional: f.token,
    source_file: "lib/glossary/term-forbidden-registry.ts",
    source_symbol: "TERM_FORBIDDEN_REGISTRY",
    source_line: null,
    value_type: "forbidden_registry",
    output_field: null,
    notes: `${f.severity}: ${f.reason}`,
    nsForLookup: f.namespace,
    dispositionHint: f.severity === "redline" || f.severity === "never_compute" ? "blocked" : f.severity,
  });
}

// Relation templates (dynamic_unresolved value sets)
for (const tpl of [
  "{a}{b}相冲",
  "{a}{b}半合{element}",
  "{branches}三合{element}",
  "{a}{b}相刑",
  "{a}{b}相害",
  "{a}{b}六合",
  "日主{stemA}{stemB}相合",
]) {
  pushTerm(localTerms, seen, {
    namespace: "bazi",
    traditional: tpl,
    source_file: "lib/calculations/relation-engine.ts",
    source_symbol: "computeChartRelations/han templates",
    source_line: null,
    value_type: "dynamic",
    output_field: "ChartFactPack.text / relation inventory",
    notes: "Template only — full combinatorial set is dynamic_unresolved; do not invent concrete pairs",
    nsForLookup: "bazi",
    dispositionHint: null,
  });
  // Override coverage for templates
  const last = localTerms[localTerms.length - 1]!;
  last.coverage_status = "dynamic_unresolved";
  last.current_disposition = "dynamic_unresolved";
}

// Qimen delivery door keys (traditional door names used as Record keys)
for (const door of ["開門", "休門", "生門", "景門", "杜門", "傷門", "死門", "驚門"]) {
  pushTerm(localTerms, seen, {
    namespace: "qimen",
    traditional: door,
    source_file: "lib/llm/pro/delivery/page-schema/qimen-fact-pack.ts",
    source_symbol: "DELIVERY_DOOR_TENSION_ZH",
    source_line: null,
    value_type: "runtime_const",
    output_field: "DeliveryQimenFactPack.zhi_shi_door / door_meaning_zh",
    notes: "Traditional door glyph (full-form 門) used in delivery lock pack",
    nsForLookup: "qimen",
  });
}

for (const m of ["禄", "权", "科", "忌"]) {
  pushTerm(localTerms, seen, {
    namespace: "ziwei",
    traditional: m,
    source_file: "lib/ziwei/fact-pack.ts",
    source_symbol: "MUTAGEN_ORDER",
    source_line: 24,
    value_type: "runtime_const",
    output_field: "ZiweiFactPack.sihua[].mutagen",
    notes: "Single-char mutagen fragment; user-facing usually via 化禄/化权/化科/化忌 SSOT",
    nsForLookup: "ziwei",
    dispositionHint: "internal_only",
  });
}

// Phase 9 inventory extras (adjective / not in ZIWEI_RUNTIME) — read prior inventory, no invent
{
  const p9path = join(ROOT, ".cursor/docs/terms-phase9-ziwei-inventory.json");
  if (existsSync(p9path)) {
    const p9 = JSON.parse(readFileSync(p9path, "utf8")) as {
      factPackTokens?: Record<string, string[]>;
      notInFactPackButInEngine?: Record<string, string[]>;
    };
    for (const [bucket, toks] of Object.entries(p9.factPackTokens ?? {})) {
      if (!Array.isArray(toks)) continue;
      for (const trad of toks) {
        if (typeof trad !== "string" || !/^[\u4e00-\u9fff]{1,8}$/.test(trad)) continue;
        pushTerm(localTerms, seen, {
          namespace: "ziwei",
          traditional: trad,
          source_file: ".cursor/docs/terms-phase9-ziwei-inventory.json",
          source_symbol: `factPackTokens.${bucket}`,
          source_line: null,
          value_type: "phase9_inventory",
          output_field: bucket,
          notes: "Observed in Phase 9 FactPack inventory across sample births",
          nsForLookup: "ziwei",
        });
      }
    }
  }
}

// doushu constants (dir skipped in candidate scan to avoid pattern-file double-noise)
{
  const cpath = join(ROOT, "lib/ziwei/doushu/constants.ts");
  if (existsSync(cpath)) {
    const src = readFileSync(cpath, "utf8");
    // PALACE_NAMES_ORDER uses 兄弟宫 etc — traditional with 宫 suffix
    const palaceRe = /'([\u4e00-\u9fff]{2,4}宫?)'/g;
    let pm: RegExpExecArray | null;
    const inPalaceBlock = src.includes("PALACE_NAMES_ORDER");
    if (inPalaceBlock) {
      const block = src.slice(src.indexOf("PALACE_NAMES_ORDER"), src.indexOf("PALACE_NAMES_ORDER") + 400);
      const re = /'([^']+)'/g;
      while ((pm = re.exec(block))) {
        pushTerm(localTerms, seen, {
          namespace: "ziwei",
          traditional: pm[1]!,
          source_file: "lib/ziwei/doushu/constants.ts",
          source_symbol: "PALACE_NAMES_ORDER",
          source_line: null,
          value_type: "runtime_const",
          output_field: "doushu chart palace names (may use 宫 suffix)",
          notes: "Vendor order; FactPack/iztro may normalize without 宫 suffix",
          nsForLookup: "ziwei",
          dispositionHint: "internal_only",
        });
      }
    }
    for (const name of [
      "子时",
      "丑时",
      "寅时",
      "卯时",
      "辰时",
      "巳时",
      "午时",
      "未时",
      "申时",
      "酉时",
      "戌时",
      "亥时",
    ]) {
      pushTerm(localTerms, seen, {
        namespace: "ziwei",
        traditional: name,
        source_file: "lib/ziwei/doushu/constants.ts",
        source_symbol: "SHICHEN",
        source_line: null,
        value_type: "runtime_const",
        output_field: null,
        notes: "时辰名 — calendar/shichen; shared with bazi clock concepts",
        nsForLookup: "ziwei",
        dispositionHint: "internal_only",
      });
    }
    void palaceRe;
  }
}

// Scan calculation dirs for Han string literals (static only) — candidate layer
const SCAN_DIRS = [
  "lib/calculations",
  "lib/calendar",
  "lib/ziwei",
  "lib/qimen",
  "lib/glossary",
  "lib/poju/data",
  "lib/llm/pro/delivery/page-schema",
  "lib/compatibility/calculations",
];

const HAN_LIT_RE = /["'`]([\u4e00-\u9fff]{2,8})["'`]/g;
const DYNAMIC_NOTES: string[] = [];
const PROSE_SKIP = new Set([
  "安全", "支持", "输出", "输入", "禁止", "允许", "必须", "不能", "不要", "以及", "或者",
  "如果", "然后", "因此", "所以", "这个", "那个", "什么", "如何", "可以", "进行", "使用",
  "用户", "系统", "报告", "内容", "文件", "函数", "类型", "字段", "数据", "计算", "结果",
  "当前", "本地", "真算", "结构", "主张", "批断", "正文", "依据", "菜单", "喂料", "闸门",
  "进取", "守养", "藏隐", "退避", "显名", // delivery stance vernacular — not classical term SSOT
]);

function stripTsComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return acc;
  for (const name of readdirSync(abs)) {
    const p = join(abs, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "doushu") continue; // patterns already extracted
      walkFiles(relative(ROOT, p).replace(/\\/g, "/"), acc);
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) {
      acc.push(relative(ROOT, p).replace(/\\/g, "/"));
    }
  }
  return acc;
}

for (const dir of SCAN_DIRS) {
  for (const file of walkFiles(dir)) {
    if (
      file.includes("phase6-terms-export") ||
      file.includes("pojulife-terms.ts") ||
      file.includes("term-glossary-closed") ||
      file.endsWith("extract-phase12a.ts")
    ) {
      continue;
    }
    let text = "";
    try {
      text = readFileSync(join(ROOT, file), "utf8");
    } catch {
      continue;
    }
    if (text.includes("join(") && text.includes("干") && text.includes("支")) {
      DYNAMIC_NOTES.push(`${file}: may concatenate 干支 dynamically`);
    }
    if (/\$\{[^}]+\}[^`]*[\u4e00-\u9fff]/.test(text) || /[\u4e00-\u9fff][^`]*\$\{/.test(text)) {
      DYNAMIC_NOTES.push(`${file}: template literal may embed traditional fragments`);
    }
    const stripped = stripTsComments(text);
    let m: RegExpExecArray | null;
    const re = new RegExp(HAN_LIT_RE.source, "g");
    while ((m = re.exec(stripped))) {
      const trad = m[1]!;
      if (PROSE_SKIP.has(trad)) continue;
      if (/[的是了吗呢吧着过吗]/.test(trad)) continue;
      if (trad.length >= 6 && /[与和及或]/.test(trad)) continue;
      const line = stripped.slice(0, m.index).split("\n").length;
      const nsGuess: TermNs | "engine" =
        file.includes("/qimen/") || file.includes("\\qimen\\")
          ? "qimen"
          : file.includes("/ziwei/") || file.includes("\\ziwei\\")
            ? "ziwei"
            : file.includes("shensha") || file.includes("bazi") || file.includes("tengod")
              ? "bazi"
              : "engine";
      pushTerm(localTerms, seen, {
        namespace: nsGuess === "engine" ? "engine_scan" : nsGuess,
        traditional: trad,
        source_file: file,
        source_symbol: "candidate_literal_scan",
        source_line: line,
        value_type: "candidate_literal",
        output_field: null,
        notes:
          "CANDIDATE: Han literal after comment-strip; may be soft-label/prose — verify before SSOT promotion",
        nsForLookup: nsGuess === "engine" ? null : nsGuess,
      });
    }
  }
}

// --- SSOT export ---
const ssotExport = {
  meta: {
    extracted_at: new Date().toISOString(),
    git_sha: sha(),
    branch: branch(),
    term_count: POJU_TERMS.length,
    namespaces: TERM_NS_ALL,
    availability: TERM_NS_AVAILABILITY,
  },
  terms: POJU_TERMS.map((t) => ({
    ns: t.ns,
    slug: t.slug,
    traditional: t.traditional,
    aliases: t.aliases ?? [],
    polarity: t.polarity,
    term: t.term,
    definition: t.definition,
  })),
  by_ns: Object.fromEntries(
    TERM_NS_ALL.map((ns) => [ns, POJU_TERMS.filter((t) => t.ns === ns).length]),
  ),
};

// Phase 11 check on current branch (36 A-class + 14 prior = 50)
const ziweiSlugs = POJU_TERMS.filter((t) => t.ns === "ziwei").map((t) => t.slug);
const phase11New36 = [
  "zw_peer_bond_field",
  "zw_partnership_field",
  "zw_continuity_field",
  "zw_resource_flow_field",
  "zw_resilience_field",
  "zw_mobility_field",
  "zw_collab_network_field",
  "zw_role_craft_field",
  "zw_anchorage_field",
  "zw_inner_reserve_field",
  "zw_origin_support_field",
  "zw_config_water_dual",
  "zw_config_wood_triple",
  "zw_config_metal_quad",
  "zw_config_earth_penta",
  "zw_config_fire_hexa",
  "zw_star_apex_axis",
  "zw_star_pattern_sense",
  "zw_star_radiant_out",
  "zw_star_craft_edge",
  "zw_star_ease_bond",
  "zw_star_intense_edge",
  "zw_star_storehouse",
  "zw_star_inward_tide",
  "zw_star_desire_drive",
  "zw_star_voice_gate",
  "zw_star_protocol",
  "zw_star_elder_shade",
  "zw_star_breach_force",
  "zw_star_reset_edge",
  "zw_star_script_clarity",
  "zw_star_lyric_flow",
  "zw_star_left_support",
  "zw_star_right_support",
  "zw_star_resource_cache",
  "zw_star_ignition",
];
const phase11PresentCount = phase11New36.filter((s) => ziweiSlugs.includes(s)).length;
const phase11Present = phase11PresentCount === phase11New36.length;
let phase11BranchZiweiCount: number | null = null;
try {
  const out = execSync(
    "git show feat/phase11-ziwei-terminology-completion:lib/glossary/pojulife-terms.ts",
    { cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  phase11BranchZiweiCount = (out.match(/ns:\s*"ziwei"/g) ?? []).length;
} catch {
  phase11BranchZiweiCount = null;
}

const AUTHORITATIVE_TYPES = new Set([
  "enum_closed",
  "relation_enum",
  "runtime_const",
  "pattern_library",
  "forbidden_registry",
  "phase9_inventory",
]);

write("01-current-ssot.json", ssotExport);
write("02-local-traditional-terms.json", {
  meta: {
    extracted_at: new Date().toISOString(),
    git_sha: sha(),
    count: localTerms.length,
    authoritative_count: localTerms.filter((t) => AUTHORITATIVE_TYPES.has(t.value_type)).length,
    candidate_scan_count: localTerms.filter((t) => t.value_type === "candidate_literal").length,
    dynamic_count: localTerms.filter((t) => t.value_type === "dynamic").length,
    method:
      "closed-set/dictionary/runtime/forbidden/pattern/phase9 + comment-stripped candidate Han literal scan",
  },
  terms: localTerms.sort((a, b) =>
    a.namespace === b.namespace
      ? a.traditional.localeCompare(b.traditional, "zh")
      : a.namespace.localeCompare(b.namespace),
  ),
});

write("03-factpack-field-inventory.json", {
  meta: {
    git_sha: sha(),
    note: "Types + builders from source; sample values synthetic/code-derived only — no user PII",
  },
  packs: [
    {
      system: "bazi",
      type_file: "lib/llm/pro/delivery/page-schema/chart-fact-pack.ts",
      type_name: "ChartFactPack",
      type_shape: {
        text: "string",
        day_master: "string",
        ganzhi: "string[]",
        shen_sha: "string[]",
      },
      builder: "buildChartFactPack(structured, opts?)",
      upstream: [
        "ProfileStructured (lib/profile + lib/calculations)",
        "citeableShenSha / TERM_FORBIDDEN_REGISTRY",
        "computeNatalChartRelations → relationLabel",
        "resolveLuckCycles (大运/流年/流月/流日)",
      ],
      fields: [
        {
          name: "text",
          holds_traditional: true,
          structured: false,
          example_fragments: ["日主：甲（身强）", "用神：水", "年柱 甲子 天干甲 地支子 十神比肩 藏干癸 神煞…", "本盘合冲刑害：子午相冲", "当前大运：…"],
          notes: "Concatenated traditional prose — primary judgment feed",
        },
        {
          name: "day_master",
          holds_traditional: true,
          structured: true,
          example: "甲",
        },
        {
          name: "ganzhi",
          holds_traditional: true,
          structured: true,
          example: ["甲子", "丙寅"],
          notes: "Pillar + luck cycle pairs collected into set",
        },
        {
          name: "shen_sha",
          holds_traditional: true,
          structured: true,
          notes: "Only citeable (non-forbidden) names",
        },
      ],
      call_chain:
        "BirthInfo → buildProfileStructured → buildChartFactPack → slice-for-page / thesis calc feed / book-judgment → delivery pages → sanitize-export",
      enters_prompt: true,
      enters_report: true,
      enters_reminder: "indirect via companion / atmos packs derived from structured",
      enters_pdf_html: "via delivery HTML + export sanitize",
    },
    {
      system: "ziwei",
      type_file: "lib/ziwei/fact-pack.ts",
      type_name: "ZiweiFactPack",
      type_shape: {
        topicPalace: "ZiweiTopicPalace",
        sihua: "ZiweiSihuaHit[]",
        daxian: "ZiweiDaxian",
        mingShen: "ZiweiMingShen",
        otherChart: "null",
        patternHits: "ZiweiPatternHit[]",
        palaces: "ZiweiPalaceFact[]",
        source: "ZiweiFactSource",
      },
      builder: "buildZiweiFactPack(birth, options?)",
      engines: ["iztro (chart structure)", "ziwei-doushu detectPatterns (patternHits)"],
      fields: [
        {
          name: "topicPalace.palace / majorStars / oppositePalace / oppositeMajorStars",
          holds_traditional: true,
          example: { palace: "命宫", majorStars: ["紫微", "天府"] },
        },
        {
          name: "sihua[].mutagen/star/palace",
          holds_traditional: true,
          example: { mutagen: "禄", star: "武曲", palace: "财帛" },
        },
        {
          name: "daxian (range/palace/stem/branch/majorStars) + nested liunian",
          holds_traditional: true,
        },
        {
          name: "mingShen.soul/body/shenPalace/fiveElementsClass",
          holds_traditional: true,
          example: { soul: "贪狼", body: "火星", shenPalace: "迁移", fiveElementsClass: "木三局" },
        },
        {
          name: "patternHits[].name",
          holds_traditional: true,
          notes: "Classical pattern names; Phase 10 Prompt uses hit_id soft isolation",
        },
        {
          name: "palaces[]",
          holds_traditional: true,
          notes: "12 palace names + majorStars; minor/adjective may exist in iztro but FactPack majorStars-focused",
        },
        { name: "otherChart", holds_traditional: false, notes: "always null" },
      ],
      display_projection: [
        "lib/ziwei/display-fact-pack.ts",
        "lib/ziwei/soft-zfp-labels.ts",
        "lib/llm/pro/delivery/slice-for-page.ts",
        "lib/ziwei/sanitize-prompt-ziwei-leaks.ts",
      ],
      call_chain:
        "BirthInfo → buildZiweiFactPack → DisplayFactPack/soft labels → baseline-lens / page slice / judgment (sanitized) → HTML/PDF sanitize",
      enters_prompt: "soft / hit_id projected (raw retained in pack)",
      enters_baseline: true,
      enters_report: "pages that feed ZFP",
    },
    {
      system: "qimen",
      type_file: "lib/llm/pro/delivery/page-schema/qimen-fact-pack.ts",
      type_name: "DeliveryQimenFactPack",
      type_shape: {
        qimen_cast_at: "string ISO",
        ju_name: "string",
        zhi_fu_star: "string",
        zhi_fu_palace: "string",
        zhi_shi_door: "string",
        zhi_shi_palace: "string",
        host_guest: "string",
        stance: "DeliveryQimenStance",
        stance_zh: "string",
        door_meaning_zh: "string",
        wang_xiang: "string",
        palace_lines: "string[]",
        text: "string",
      },
      builder: "castDeliveryQimenFactPack → mergeQimenIntoChartFactPackText",
      engine: "lib/qimen (dictionary / LunarUtil / QimenUtil) — Syncro-同源",
      fields_note:
        "Traditional 门/星/神/宫 in engine cells; delivery pack stores traditional door/star/palace strings + vernacular stance_zh/door_meaning_zh",
      call_chain:
        "cast lock (qimen_cast_at idempotent) → DeliveryQimenFactPack → ChartFactPack.text merge → P4 judgment/body → gates p4_qimen_lock_missing",
      enters_prompt: "P4 metaphysics path; locked cast",
      enters_report: "P4",
      enters_reminder: false,
    },
    {
      system: "glyph / i_ching",
      note: "SSOT has ns=glyph rows; no GlyphFactPack / dedicated calc builder found under lib/ in this pass.",
      factpack: null,
      searched: ["lib/**/*glyph*", "lib/**/*iching*", "lib/**/*yijing*", "ALLOW_CONCEPT / compliance"],
    },
    {
      system: "zodiac",
      note: "SSOT ns=zodiac active; no independent ZodiacFactPack — animal tokens may appear via calendar/profile helpers",
      factpack: null,
    },
  ],
});

write("04-output-path-inventory.json", {
  meta: { git_sha: sha(), note: "Paths verified by file existence + call-site grep; not runtime traced" },
  paths: [
    {
      id: "personal_baseline_portrait",
      checked: ["lib/poju/baseline-profile-offline-html.ts", "lib/poju/baseline-interactive-html.ts", "lib/ziwei/baseline-lens.ts"],
      source_fields: ["ZiweiFactPack via DisplayFactPack", "matrix fact panel / ProfileStructured"],
      glossary: true,
      sanitize: "soft-zfp-labels + matrix-term-labels + shensha soft map",
      raw_fallback_risk: "matrix-term-labels still calls pojuTermByTraditional without ns in places",
      may_bypass_term_resolve: "if soft label missing on main pre-Phase11, UI may show — / empty rather than traditional (fail-closed)",
    },
    {
      id: "matrix_fact_panel",
      entry: "lib/poju/build-matrix-fact-panel.ts",
      source_fields: ["ten_god", "shen_sha", "relations", "pillars"],
      glossary: true,
      sanitize: "partial — pojuTermByTraditional(tg) no-ns call sites present",
      notes: "Feeds baseline / debug panels",
    },
    {
      id: "delivery_report_pages_p1_p6",
      entry: "lib/llm/pro/delivery/** + final-delivery.ts",
      source_fields: ["ChartFactPack.text", "DeliveryQimenFactPack", "soft ZFP", "judgment/body slots"],
      glossary: "⟦t:⟧ via term-marking after generation",
      sanitize: "sanitize-delivery-book + export surfaces",
      raw_fallback_risk: "CFP traditional intentionally in judgment prompts; user body should be zero-classical per output contract",
    },
    {
      id: "ai_chat_oriental_context",
      entry: "lib/llm/phases/oriental-prompt-context.ts (+ v6)",
      glossary: "buildTermContextForFacts",
      enters_prompt: true,
    },
    {
      id: "base_analysis_stream",
      entry: "lib/llm/prompts/base-analysis-stream-prompt.ts",
      notes: "Instructs against listing 藏干/十神 stacks in user copy",
    },
    {
      id: "book_judgment_prompt",
      entry: "lib/llm/pro/delivery/book-judgment/generate.ts",
      sanitize: "sanitizeZiweiLeaksInPromptText on thesis/science/agenda/question",
      raw_fallback: "CFP bazi traditional kept intentionally for mechanism claims",
    },
    {
      id: "term_marking_compliance",
      entry: "lib/llm/sanitize/term-marking.ts + compliance-terms.ts",
      notes: "⟦t:⟧ markers; still has some pojuTermByTraditional without ns",
    },
    {
      id: "export_sanitize_all_surfaces",
      entry: "lib/glossary/sanitize-export-surface.ts + ns-aware-surface-sanitize.ts",
      surfaces: ["plain", "markdown", "html", "email", "push", "copy", "pdf"],
      dual_ns: "P1 confirmedTerms + sourceId fail-closed for 空亡/白虎 etc.",
    },
    {
      id: "companion_day_html",
      entry: "lib/companion/day-html.ts",
      sanitize: "sanitizePlainExport(..., email)",
      confirmedTerms: "optional opts — callers must wire",
    },
    {
      id: "reminder_30day_offline_html",
      entry: "lib/companion/reminder-day-offline-html.ts",
      sanitize: "sanitizePlainExport",
      confirmedTerms: "optional — decision-anchor copy path",
      notes: "30-day companion pack; 流日 as optional background not main narrative",
    },
    {
      id: "daily_decision_anchor",
      entry: "lib/companion/types.ts DecisionAnchor slots + companion-daily-prompt.ts",
      source_fields: ["today_is", "suitable", "suggestion", "unsuitable", "evidence"],
      glossary: "optional ⟦t:slug|plain⟧ in evidence",
      sanitize: "via reminder HTML sanitizePlainExport when rendered",
      notes: "Checked companion prompt + types; not a separate FactPack",
    },
    {
      id: "decision_report_offline_html",
      entry: "lib/poju/decision-report-offline-html.ts",
      sanitize: "verify per-builder wiring in later phase",
    },
    {
      id: "delivery_interactive_html",
      entry: "lib/poju/delivery-interactive-html.ts / delivery-marked-html.ts",
      glossary: "marked HTML path for ⟦t:⟧",
    },
    {
      id: "audit_output_banned",
      entry: "lib/llm/compliance/audit-output.ts + banned-terms.ts",
      notes: "Post-hoc classical leak detection — complementary to glossary soft map",
    },
    {
      id: "email_delivery",
      checked: ["lib/companion/day-html.ts email surface", "sanitize-export-surface email"],
      notes: "Companion/reminder use email surface; marketing share pages not fully enumerated",
    },
    {
      id: "share_pages",
      checked: ["search share/marketing under app/ — thin for chart traditional"],
      notes: "No dedicated chart-term share pipeline found in this pass; marketing likely brand-only",
      status: "checked_thin",
    },
  ],
});

// Collisions
const byTrad = new Map<string, PojuTerm[]>();
for (const t of POJU_TERMS) {
  const arr = byTrad.get(t.traditional) ?? [];
  arr.push(t);
  byTrad.set(t.traditional, arr);
}
const collisions = [...byTrad.entries()]
  .filter(([, arr]) => new Set(arr.map((x) => x.ns)).size > 1)
  .map(([traditional, arr]) => ({
    traditional,
    namespaces: arr.map((x) => ({ ns: x.ns, slug: x.slug, zh: x.term.zh })),
  }));

write(
  "05-namespace-collision-report.md",
  `# Namespace collision report

Git: \`${sha()}\` · branch \`${branch()}\`

## Cross-namespace same traditional in SSOT

Count: **${collisions.length}**

${collisions
  .map(
    (c) =>
      `### ${c.traditional}\n` +
      c.namespaces.map((n) => `- **${n.ns}** \`${n.slug}\` → ${n.zh}`).join("\n"),
  )
  .join("\n\n")}

## Notable dual-ns (product-critical)

| traditional | bazi | qimen | ziwei |
|---|---|---|---|
| 空亡 | forbidden/redline | legal soft (覆盖缺口) | — |
| 白虎 | forbidden/redline | legal soft (冲击) | — |
| 七杀 | qi_sha 淬炼 | — | zw_star_breach_force (Phase11 branch) or missing on main |
| 文昌 | wen_chang 慧思 | — | zw_star_script_clarity (Phase11) / also CLOSED_SHEN_SHA |
| 流年 | year 岁环 | — | zw_yearly_cycle 年度周期 |

## Resolver risks

- \`pojuTermByTraditional\` without namespace still exists (deprecated) — cross-ns first-match risk.
- \`resolvePojuTerm(input, { namespace })\` is the required API.
- P1 ns-aware sanitize: dual-ns bare tokens fail-closed unless segment-scoped confirmedTerms.
`,
);

const missing = localTerms.filter((t) => t.coverage_status === "missing");
const missingUnique = [...new Map(missing.map((t) => [`${t.namespace}|${t.traditional}`, t])).values()];
const missingAuth = missingUnique.filter((t) => AUTHORITATIVE_TYPES.has(t.value_type));
const missingCand = missingUnique.filter((t) => t.value_type === "candidate_literal");
const missingOther = missingUnique.filter(
  (t) => !AUTHORITATIVE_TYPES.has(t.value_type) && t.value_type !== "candidate_literal",
);

function missingTable(rows: LocalTerm[], limit = 250): string {
  return (
    `| namespace | traditional | value_type | sample source | notes |\n|---|---|---|---|---|\n` +
    rows
      .slice(0, limit)
      .map(
        (t) =>
          `| ${t.namespace} | ${t.traditional} | ${t.value_type} | ${t.source_file} | ${t.notes.replace(/\|/g, "/")} |`,
      )
      .join("\n") +
    (rows.length > limit ? `\n\n… truncated ${rows.length - limit} more (see 02 JSON).\n` : "")
  );
}

write(
  "06-missing-terms-report.md",
  `# Missing terms report

Local traditional tokens with \`coverage_status=missing\` (unique by ns+traditional).

| Layer | Unique count |
|---|---|
| All missing | ${missingUnique.length} |
| Authoritative (closed-set / runtime / pattern / forbidden / phase9) | ${missingAuth.length} |
| Candidate literal scan | ${missingCand.length} |
| Other | ${missingOther.length} |

> Do **not** auto-promote to \`internal_only\` / \`blocked\` — product review required.
> Candidate rows are often soft-labels, stance vernacular, or prose — triage carefully.

## Authoritative missing (priority triage)

${missingTable(missingAuth, 300)}

## Candidate scan missing (verify context)

${missingTable(missingCand, 150)}
`,
);

write(
  "07-disposition-report.md",
  `# Disposition report

## Namespace availability
${TERM_NS_ALL.map((ns) => `- **${ns}**: ${TERM_NS_AVAILABILITY[ns]} · SSOT rows ${ssotExport.by_ns[ns]}`).join("\n")}

## Forbidden registry (bazi-scoped redlines etc.)
Count: ${TERM_FORBIDDEN_REGISTRY.length}

| ns | token | severity | reason |
|---|---|---|---|
${TERM_FORBIDDEN_REGISTRY.map((f) => `| ${f.namespace} | ${f.token} | ${f.severity} | ${f.reason} |`).join("\n")}

## Ziwei runtime disposition (main)
On **main** (${branch()} @ ${sha().slice(0, 8)}): palace/star/config tokens (except 命宫 SSOT) are largely \`internal_only\` pending Phase 11 merge.
Phase 11 branch marks those 36 as \`public_glossary\` + SSOT.

Sample:
| token | disposition |
|---|---|
| 命宫 | via SSOT resolve (zw_identity_field) |
| 紫微 | ${ziweiTokenDisposition("紫微").status} |
| 仆役 | ${ziweiTokenDisposition("仆役").status} |
| 木三局 | ${ziweiTokenDisposition("木三局").status} |
| 杀破狼 | ${ziweiTokenDisposition("杀破狼").status} |

## ShenSha disposition
Uses \`resolveShenshaDisposition\` / Phase 4 fail-closed map (soft labels; redlines empty).
`,
);

write(
  "08-sanitizer-and-prompt-audit.md",
  `# Sanitizer and prompt audit

## Core APIs
| API | file | notes |
|---|---|---|
| resolvePojuTerm | lib/glossary/term-resolve.ts | namespace-aware resolve |
| pojuTermBySlug | lib/glossary/pojulife-terms.ts | slug authority for ⟦t:⟧ |
| pojuTermByTraditional | lib/glossary/pojulife-terms.ts | **deprecated** without ns (warns) |
| buildTermContextForFacts | lib/glossary/term-context-for-facts.ts | prompt fact context |
| ziweiTokenDisposition | lib/ziwei/token-disposition.ts | internal_only / unknown_blocked |
| softZiweiLabel / sanitizeZiweiLeaksInPromptText | lib/ziwei/soft-zfp-labels.ts, sanitize-prompt-ziwei-leaks.ts | Phase 10 |
| applyNsAwareSurfacePolicy | lib/glossary/ns-aware-surface-sanitize.ts | P1 dual-ns |
| sanitizeExportSurface / sanitizePlainExport | lib/glossary/sanitize-export-surface.ts | export exits |
| resolveShenshaDisposition | lib/glossary/shensha-disposition.ts | unknown_blocked; no raw fallback |
| TERM_FORBIDDEN_REGISTRY | lib/glossary/term-forbidden-registry.ts | bazi redlines |
| term-marking / compliance-terms | lib/llm/sanitize/* | ⟦t:⟧ |
| qimen display-policy | lib/qimen/display-policy.ts | soft maps |
| audit-output / banned-terms | lib/llm/compliance/* | post-hoc leak scan |

## Call sites still using pojuTermByTraditional (grep)
| file | risk |
|---|---|
| lib/llm/sanitize/term-marking.ts | some no-ns + bazi-fallback chains |
| lib/base-analysis/core-judgments.ts | bazi then no-ns fallback |
| lib/glossary/term-glossary-closed.ts | bazi then no-ns |
| lib/glossary/term-glossary.ts | no-ns first |
| lib/llm/compliance/banned-terms.ts | bazi then no-ns |
| lib/poju/build-matrix-fact-panel.ts | **no-ns** on ten_god |
| lib/poju/matrix-term-labels.ts | **no-ns** |
| lib/poju/shensha-alias.ts | bazi then no-ns |

## Findings (report-only — no fixes in Phase 12-A)
1. **No-ns lookup still live** in matrix / glossary / term-marking paths → cross-ns first-match risk for dual-ns hans (七杀/文昌/流年/空亡/白虎).
2. **Dual-ns 空亡/白虎**: P1 confirmedTerms + sourceId; bare text fail-closed on ns-aware surfaces; paths that skip confirmedTerms remain risky.
3. **Ziwei pattern names**: isolated via hit_id in judgment prompts; raw FactPack retains classical names; Phase 10 scrub on free-text.
4. **CFP (bazi)** intentionally keeps traditional in judgment feed; user-visible body contract is zero-classical.
5. **Export surfaces** unified; companion/reminder HTML accept optional confirmedTerms — **callers must wire** or dual-ns soft may not apply.
6. **Unknown ziwei** fail-closed (empty soft / blocked) — no traditional fallback (shensha disposition same philosophy).
7. **qm_* markers**: P1 — slug authority only; unknown qm_* no traditional-fallback resolve.
8. **FactPack vs projection**: raw traditional retained in packs; safety projection (soft/hit_id) can drop classical surface while mechanism remains for model — product must accept that semantic loss is intentional for user surfaces.
9. **Path skew**: \`lib/poju/**\` HTML builders do not all call \`sanitizeExportSurface\` directly (grep empty under lib/poju for that symbol) — some rely on upstream marked HTML / companion wrappers; verify each exit in later phase.
10. Do **not** treat all traditional as forbidden — banned-terms/audit is leak detection complementary to SSOT soft map.

## Prompt builders checked
- oriental-prompt-context(+v6)
- base-analysis-stream-prompt
- book-judgment/generate feedBlock
- page-slice-feed / fill-prompt / deep-evidence-*
- companion-daily-prompt (decision-anchor five slots)
`,
);

// CSV matrix
const csvHeader =
  "namespace,traditional,source_file,source_symbol,source_line,current_slug,zh,en,es,de,fr,definition_status,disposition,output_path,coverage_status,notes";
const csvRows = localTerms.map((t) => {
  const term = t.current_slug ? POJU_TERMS.find((x) => x.slug === t.current_slug) : undefined;
  const defStatus = term
    ? ["zh", "en", "es", "de", "fr"].every((l) => term.definition[l as "zh"]?.trim())
      ? "complete"
      : "incomplete"
    : "n/a";
  const esc = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
  return [
    t.namespace,
    t.traditional,
    t.source_file,
    t.source_symbol,
    t.source_line ?? "",
    t.current_slug ?? "",
    term?.term.zh ?? "",
    term?.term.en ?? "",
    term?.term.es ?? "",
    term?.term.de ?? "",
    term?.term.fr ?? "",
    defStatus,
    t.current_disposition ?? "",
    t.output_field ?? "",
    t.coverage_status,
    t.notes,
  ]
    .map((x) => esc(String(x)))
    .join(",");
});
write("09-coverage-matrix.csv", csvHeader + "\n" + csvRows.join("\n") + "\n");

write(
  "10-unresolved-items.md",
  `# Unresolved / dynamic items

## Dynamic generators (cannot fully enum without runtime)
${[...new Set(DYNAMIC_NOTES)].slice(0, 80).map((n) => `- ${n}`).join("\n") || "- (no concat heuristics fired)"}
${DYNAMIC_NOTES.length > 80 ? `\n… +${DYNAMIC_NOTES.length - 80} more path heuristics\n` : ""}

- **六十甲子 / 干支 pairs**: combinatorial from stems×branches (qimen 旬首表 lists subsets; full 60 may be generated).
- **Relation strings**: \`relation-engine\` builds labels like \`子午相冲\` dynamically — templates recorded as \`dynamic_unresolved\`; concrete pairs not invented.
- **iztro adjectiveStars / boshi12 / changsheng12 / jiangqian12 / suiqian12**: present in engine; FactPack currently does **not** expose full sets (Phase 9 C-class). Values may appear if future fields expand.
- **Pattern hits**: static names in \`lib/ziwei/doushu/patterns.ts\`; which fire is birth-dependent.
- **神煞 computation**: activates subset of CLOSED_SHEN_SHA per chart — closed set known; activation dynamic.
- **Glyph / I Ching**: SSOT ns=glyph exists; dedicated calc FactPack not found in this pass.
- **Zodiac ns**: availability active; calc surface thin vs bazi/qimen/ziwei.
- **Candidate Han scan**: may include soft POJU labels / vernacular — not asserted as classical terms.

## Phase 11 status on this checkout
- Branch: \`${branch()}\`
- Ziwei SSOT count on tip: **${ziweiSlugs.length}** (expect 14 on main pre-merge; 50 on Phase 11 branch)
- Phase 11 new-36 present on tip: **${phase11PresentCount}/${phase11New36.length}**
- Phase 11 branch \`feat/phase11-ziwei-terminology-completion\` ziwei count: **${phase11BranchZiweiCount ?? "n/a"}**
- Missing on tip from the 36: ${phase11New36.filter((s) => !ziweiSlugs.includes(s)).join(", ") || "(none)"}

## Phase 9 leftovers (ziwei still not in public SSOT by design on main)
- Pattern classical names → \`internal_only\` (Phase 10 hit_id)
- Aux/adjective stars beyond ZIWEI_RUNTIME_STARS → see Phase 9 inventory C-class
- Do not re-add the Phase 11 36 once merged

## Manual review needed
- Whether qimen 门/星/神 soft labels cover every dictionary value in user P4 output.
- Whether all export HTML builders pass \`confirmedTerms\`/\`sourceId\`.
- Whether legacy Syncro paths under \`legacy/\` are still shipped (excluded from product SSOT unless linked).
- Triage \`06\` authoritative missing vs candidate noise before any Phase 12-B 补词.
`,
);

const byStatus: Record<string, number> = {};
for (const t of localTerms) {
  byStatus[t.coverage_status] = (byStatus[t.coverage_status] ?? 0) + 1;
}
const byNs: Record<string, number> = {};
for (const t of localTerms) {
  byNs[t.namespace] = (byNs[t.namespace] ?? 0) + 1;
}

const authRows = localTerms.filter((t) => AUTHORITATIVE_TYPES.has(t.value_type));
const authByStatus: Record<string, number> = {};
for (const t of authRows) {
  authByStatus[t.coverage_status] = (authByStatus[t.coverage_status] ?? 0) + 1;
}

write(
  "11-phase12a-final-summary.md",
  `# Phase 12-A final summary

| Field | Value |
|---|---|
| Git SHA | \`${sha()}\` |
| Branch | \`${branch()}\` |
| Extracted at | ${new Date().toISOString()} |
| SSOT total terms | ${POJU_TERMS.length} |
| SSOT by ns | ${JSON.stringify(ssotExport.by_ns)} |
| Local term rows (incl. multi-source) | ${localTerms.length} |
| Authoritative rows | ${authRows.length} |
| Candidate scan rows | ${localTerms.filter((t) => t.value_type === "candidate_literal").length} |
| Unique missing (all layers) | ${missingUnique.length} |
| Unique missing (authoritative) | ${missingAuth.length} |
| Cross-ns SSOT collisions | ${collisions.length} |
| Coverage histogram (all rows) | ${JSON.stringify(byStatus)} |
| Coverage histogram (authoritative) | ${JSON.stringify(authByStatus)} |
| Local rows by namespace | ${JSON.stringify(byNs)} |
| Ziwei SSOT on tip | ${ziweiSlugs.length} |
| Phase 11 new-36 on tip | ${phase11PresentCount}/36 |
| Phase 11 branch ziwei count | ${phase11BranchZiweiCount ?? "n/a"} |

## Statistical口径
- **SSOT total**: rows in \`POJU_TERMS\` on this checkout.
- **Local rows**: one row per (namespace, traditional, source_file, source_symbol); same traditional may appear from multiple sources.
- **Authoritative**: closed-set, relation enum, runtime consts, pattern library, forbidden registry, Phase 9 FactPack inventory tokens.
- **Candidate**: comment-stripped Han string literals — require human verify; not asserted classical.
- **missing**: no ns-aware SSOT resolve hit; **not** auto-classified internal/blocked.
- **internal_only / blocked**: from disposition hints (ziwei runtime, forbidden registry, pattern policy) — not inferred from missing alone.

## Method
1. Full dump of \`POJU_TERMS\`.
2. Import closed-set / runtime / dictionary / forbidden / pattern library + Phase 9 inventory.
3. Comment-stripped candidate Han literal scan of calc-related dirs.
4. FactPack + output-path + sanitizer file audit from source reading.
5. Cross-check Phase 11 branch tip for 50 ziwei SSOT without merging.

## Not done (by design)
- No SSOT mutations
- No business code changes
- No PR for inventory
- No invented terms outside code
- No 补词 / test publish

## Next phase inputs
Use \`06\` authoritative missing + \`09\` matrix + \`05\` collisions for product triage before Phase 12-B.
`,
);

write(
  "00-README.md",
  `# Phase 12-A · Terminology inventory

**Nature:** documentation / data extraction only. **No business code changes.**

| | |
|---|---|
| Git SHA | \`${sha()}\` |
| Branch | \`${branch()}\` |
| Extracted | ${new Date().toISOString()} |

## Scope checked
- \`lib/glossary/**\` (SSOT, resolve, forbidden, closed-set, sanitize)
- \`lib/calculations/**\`, \`lib/calendar/**\`
- \`lib/ziwei/**\`, \`lib/qimen/**\`
- \`lib/llm/pro/delivery/**\` FactPack + slice + judgment
- \`lib/companion/**\` reminder/day HTML
- \`lib/poju/**\` baseline/delivery HTML entrypoints
- \`lib/compatibility/calculations/**\`

## Out of scope / thin
- \`legacy/**\` Syncro/match (not primary POJU delivery) — not fully enumerated
- Production user data / live DB
- Runtime enumeration of all 干支 relation strings

## Phase 9–11 note
- Phase 9 inventory JSON (path: .cursor/docs/terms-phase9-ziwei-inventory.json) ingested as authoritative ziwei observations.
- Phase 10 isolation is on this main tip.
- Phase 11 (+36 ziwei → total 50) lives on feat/phase11-ziwei-terminology-completion — tip ziwei count ${ziweiSlugs.length}; branch count ${phase11BranchZiweiCount ?? "n/a"}; new-36 present ${phase11PresentCount}/36.

## Layers in 02 / 09
- **Authoritative** value_types: enum_closed, relation_enum, runtime_const, pattern_library, forbidden_registry, phase9_inventory
- **Candidate** value_type: candidate_literal (needs human triage)
- **Dynamic** value_type: dynamic (templates only)

## Files
See 01–11 in this directory. Regenerate via:

    pnpm exec tsx .cursor/docs/phase12a-terminology-inventory/_tools/extract-phase12a.ts
`,
);

console.log("\nPhase 12-A extraction complete.");
console.log("SSOT", POJU_TERMS.length, "localRows", localTerms.length, "missingUnique", missingUnique.length);
