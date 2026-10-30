/**
 * Safe SSOT entry for pojulife terms (Phase 0).
 *
 * Canonical source: lib/glossary/pojulife-terms.ts
 * Legacy JSON docs/完整重命名清单（157）.json is outdated (155) and must not overwrite SSOT.
 *
 *   pnpm terms:check
 *   pnpm terms:generate -- --check
 *   pnpm terms:generate -- --write --from path/to/approved-terms.json
 *
 * Default: --check only (no write). Pure Node — no tsx required.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SSOT_PATH = path.join(ROOT, "lib", "glossary", "pojulife-terms.ts");
const BASELINE_PATH = path.join(
  ROOT,
  "lib",
  "glossary",
  "pojulife-terms.phase0-baseline.json",
);

const LOCALES = ["zh", "en", "es", "de", "fr"];
const EXPECTED = {
  // Phase 6: 羊刃 collapsed into fei_ren alias (was 282/185).
  total: 281,
  bazi: 184,
  qimen: 54,
  glyph: 17,
  zodiac: 12,
  ziwei: 14,
};
const VALID_NS = new Set(["bazi", "qimen", "glyph", "zodiac", "ziwei"]);
const VALID_POLARITY = new Set(["favorable", "caution", "neutral"]);

function parseArgs(argv) {
  const flags = new Set();
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--check" || a === "--write" || a === "--update-baseline" || a === "--help") {
      flags.add(a);
      continue;
    }
    if (a === "--from") {
      const v = argv[++i];
      if (!v) throw new Error("--from requires a path");
      opts.from = v;
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }
  return { flags, opts };
}

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

function extractPojuTermsArray(src) {
  const clean = stripComments(src);
  const marker = "export const POJU_TERMS";
  const idx = clean.indexOf(marker);
  if (idx < 0) throw new Error("POJU_TERMS export not found");
  const eq = clean.indexOf("=", idx);
  const start = clean.indexOf("[", eq);
  if (start < 0) throw new Error("POJU_TERMS array start not found");
  let depth = 0;
  let i = start;
  let inStr = null;
  for (; i < clean.length; i++) {
    const ch = clean[i];
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
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
  try {
    return JSON.parse(jsonish);
  } catch (e) {
    throw new Error(`Failed to parse POJU_TERMS: ${e.message}`);
  }
}

function nsSlugKey(t) {
  return `${t.ns}:${t.slug}`;
}

function countByNs(terms) {
  const counts = { bazi: 0, qimen: 0, glyph: 0, zodiac: 0, ziwei: 0 };
  for (const t of terms) counts[t.ns] = (counts[t.ns] || 0) + 1;
  return counts;
}

function nsSlugHash(terms) {
  const keys = terms.map(nsSlugKey).sort();
  return createHash("sha256").update(keys.join("\n"), "utf8").digest("hex");
}

function contentFingerprint(terms) {
  const payload = terms
    .map((t) =>
      JSON.stringify({
        ns: t.ns,
        slug: t.slug,
        traditional: t.traditional,
        aliases: t.aliases || [],
        polarity: t.polarity,
        term: t.term,
        definition: t.definition,
      }),
    )
    .sort();
  return createHash("sha256").update(payload.join("\n"), "utf8").digest("hex");
}

function conflictSig(ns, surface, a, b) {
  const keys = [a, b].sort();
  return `${ns}|${surface}|${keys[0]}|${keys[1]}`;
}

function collectAliasConflicts(terms) {
  const claimByNs = new Map();
  const conflicts = [];
  for (const t of terms) {
    const key = nsSlugKey(t);
    let nsClaims = claimByNs.get(t.ns);
    if (!nsClaims) {
      nsClaims = new Map();
      claimByNs.set(t.ns, nsClaims);
    }
    const surfaces = [t.traditional, ...(t.aliases || [])]
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    for (const surface of surfaces) {
      const owner = nsClaims.get(surface);
      if (owner && owner !== key) {
        conflicts.push({
          ns: t.ns,
          surface,
          keys: [owner, key].sort(),
          sig: conflictSig(t.ns, surface, owner, key),
        });
      } else {
        nsClaims.set(surface, key);
      }
    }
  }
  return conflicts;
}

function validateTerms(terms, { knownAliasConflictSigs = null, strictAlias = false } = {}) {
  const issues = [];
  const counts = countByNs(terms);

  if (terms.length !== EXPECTED.total) {
    issues.push({
      level: "error",
      code: "count.total",
      message: `expected total ${EXPECTED.total}, got ${terms.length}`,
    });
  }
  for (const ns of ["bazi", "qimen", "glyph", "zodiac", "ziwei"]) {
    if ((counts[ns] || 0) !== EXPECTED[ns]) {
      issues.push({
        level: "error",
        code: `count.${ns}`,
        message: `expected ${ns} ${EXPECTED[ns]}, got ${counts[ns] || 0}`,
      });
    }
  }

  const seenNsSlug = new Set();
  const seenSlug = new Map();

  for (const t of terms) {
    const key = nsSlugKey(t);
    if (!VALID_NS.has(t.ns)) {
      issues.push({
        level: "error",
        code: "schema.ns",
        message: `invalid ns on ${key}: ${String(t.ns)}`,
      });
    }
    if (!String(t.slug || "").trim()) {
      issues.push({ level: "error", code: "schema.slug", message: `empty slug on ${key}` });
    }
    if (!String(t.traditional || "").trim()) {
      issues.push({
        level: "error",
        code: "schema.traditional",
        message: `empty traditional on ${key}`,
      });
    }
    if (!VALID_POLARITY.has(t.polarity)) {
      issues.push({
        level: "error",
        code: "schema.polarity",
        message: `invalid polarity on ${key}: ${String(t.polarity)}`,
      });
    }
    if (seenNsSlug.has(key)) {
      issues.push({
        level: "error",
        code: "dup.ns_slug",
        message: `duplicate ns+slug ${key}`,
      });
    }
    seenNsSlug.add(key);

    const prior = seenSlug.get(t.slug);
    if (prior && prior !== key) {
      issues.push({
        level: "error",
        code: "dup.slug",
        message: `slug "${t.slug}" reused by ${prior} and ${key}`,
      });
    }
    seenSlug.set(t.slug, key);

    for (const loc of LOCALES) {
      if (!String(t.term?.[loc] || "").trim()) {
        issues.push({
          level: "error",
          code: "locale.term",
          message: `empty term.${loc} on ${key}`,
        });
      }
      if (!String(t.definition?.[loc] || "").trim()) {
        issues.push({
          level: "error",
          code: "locale.definition",
          message: `empty definition.${loc} on ${key}`,
        });
      }
    }
  }

  // Pre-existing ten-god vs class_* umbrella overlaps are Phase 1 ambiguous work.
  // Phase 0 freezes them as known; new conflicts still fail.
  const known = knownAliasConflictSigs ? new Set(knownAliasConflictSigs) : null;
  for (const c of collectAliasConflicts(terms)) {
    const msg = `ns=${c.ns} surface "${c.surface}" claimed by ${c.keys.join(" and ")}`;
    if (strictAlias || (known && !known.has(c.sig))) {
      issues.push({ level: "error", code: "alias.conflict", message: msg });
    } else if (known && known.has(c.sig)) {
      issues.push({
        level: "warn",
        code: "alias.conflict.known",
        message: `${msg} (known; resolvePojuTerm returns ambiguous)`,
      });
    } else {
      // No baseline yet: record as warn so --update-baseline can capture them.
      issues.push({ level: "warn", code: "alias.conflict", message: msg });
    }
  }
  return issues;
}

function loadApprovedJson(filePath) {
  const abs = path.resolve(ROOT, filePath);
  const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray(raw.terms)
      ? raw.terms
      : null;
  if (!list) {
    throw new Error(`--from JSON must be an array or { "terms": [...] }: ${abs}`);
  }
  return list;
}

function esc(s) {
  return JSON.stringify(s ?? "");
}

function emitTermObject(t) {
  const lines = [];
  lines.push(`  {`);
  lines.push(`    ns: ${esc(t.ns)},`);
  lines.push(`    slug: ${esc(t.slug)},`);
  lines.push(`    traditional: ${esc(t.traditional)},`);
  if (t.aliases?.length) {
    lines.push(`    aliases: [${t.aliases.map((a) => esc(a)).join(", ")}],`);
  }
  lines.push(`    polarity: ${esc(t.polarity)},`);
  lines.push(`    term: {`);
  for (const loc of LOCALES) lines.push(`      ${loc}: ${esc(t.term[loc])},`);
  lines.push(`    },`);
  lines.push(`    definition: {`);
  for (const loc of LOCALES) lines.push(`      ${loc}: ${esc(t.definition[loc])},`);
  lines.push(`    },`);
  lines.push(`  },`);
  return lines.join("\n");
}

function splitSsotFile(src) {
  const marker = "export const POJU_TERMS: readonly PojuTerm[] = [";
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("SSOT marker not found: POJU_TERMS array");
  const arrayStart = start + marker.length;
  let depth = 1;
  let i = arrayStart;
  let inStr = null;
  while (i < src.length) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === inStr) inStr = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      i++;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        const after = src.slice(i + 1);
        const semi = after.match(/^\s*;/);
        const footStart = i + 1 + (semi ? semi[0].length : 0);
        return {
          head: src.slice(0, start) + marker + "\n",
          foot: src.slice(footStart),
        };
      }
    }
    i++;
  }
  throw new Error("Failed to locate end of POJU_TERMS array");
}

function buildSsotSource(currentSrc, terms) {
  const { head, foot } = splitSsotFile(currentSrc);
  const patchedHead = head
    .replace(
      /\* Generated from docs\/完整重命名清单（157）\.json with Fix A\/B\/C applied\.\n/,
      "* Phase 0 canonical SSOT. Do not regenerate from legacy generate-poju-terms.mjs.\n",
    )
    .replace(
      /\* Regenerate: node scripts\/generate-poju-terms\.mjs\n/,
      "* Validate: pnpm terms:check | Safe write: pnpm terms:generate -- --write --from <approved.json>\n",
    );
  const body = terms.map(emitTermObject).join("\n");
  return `${patchedHead}${body}\n];${foot.startsWith("\n") ? foot : `\n${foot}`}`;
}

function diffTerms(before, after) {
  const a = new Map(before.map((t) => [nsSlugKey(t), t]));
  const b = new Map(after.map((t) => [nsSlugKey(t), t]));
  const diffs = [];
  for (const key of a.keys()) if (!b.has(key)) diffs.push({ kind: "removed", key });
  for (const key of b.keys()) if (!a.has(key)) diffs.push({ kind: "added", key });
  for (const [key, next] of b) {
    const prev = a.get(key);
    if (!prev) continue;
    if (prev.traditional !== next.traditional) {
      diffs.push({ kind: "field_changed", key, field: "traditional" });
    }
    if (prev.polarity !== next.polarity) {
      diffs.push({ kind: "field_changed", key, field: "polarity" });
    }
    if (JSON.stringify(prev.aliases || []) !== JSON.stringify(next.aliases || [])) {
      diffs.push({ kind: "field_changed", key, field: "aliases" });
    }
    for (const loc of LOCALES) {
      if (prev.term?.[loc] !== next.term?.[loc]) {
        diffs.push({ kind: "term_changed", key, locale: loc });
      }
      if (prev.definition?.[loc] !== next.definition?.[loc]) {
        diffs.push({ kind: "definition_changed", key, locale: loc });
      }
    }
  }
  return diffs;
}

function printDiffReport(diffs) {
  if (!diffs.length) {
    console.log("Diff report: no changes vs current SSOT.");
    return;
  }
  console.log(`Diff report (${diffs.length} item(s)):`);
  for (const d of diffs.slice(0, 200)) {
    if (d.kind === "added" || d.kind === "removed") console.log(`  [${d.kind}] ${d.key}`);
    else if (d.kind === "term_changed" || d.kind === "definition_changed") {
      console.log(`  [${d.kind}] ${d.key} (${d.locale})`);
    } else if (d.kind === "field_changed") {
      console.log(`  [${d.kind}] ${d.key}.${d.field}`);
    } else console.log(`  [${d.kind}] ${JSON.stringify(d)}`);
  }
  if (diffs.length > 200) console.log(`  … ${diffs.length - 200} more`);
}

function buildBaseline(terms) {
  const counts = countByNs(terms);
  const aliasConflicts = collectAliasConflicts(terms);
  return {
    phase: 0,
    recordedAt: "2026-10-30",
    canonicalSource: "lib/glossary/pojulife-terms.ts",
    legacyGeneratorDisabled: "scripts/generate-poju-terms.mjs",
    legacyDocOutdated: "docs/完整重命名清单（157）.json (155; missing zodiac/aliases)",
    counts: {
      total: terms.length,
      bazi: counts.bazi || 0,
      qimen: counts.qimen || 0,
      glyph: counts.glyph || 0,
      zodiac: counts.zodiac || 0,
      ziwei: counts.ziwei || 0,
    },
    expected: EXPECTED,
    nsSlugHash: nsSlugHash(terms),
    contentFingerprint: contentFingerprint(terms),
    fiveLocaleFields: ["term", "definition"],
    locales: LOCALES,
    knownAliasConflicts: aliasConflicts.map((c) => ({
      ns: c.ns,
      surface: c.surface,
      keys: c.keys,
      sig: c.sig,
    })),
    note: "Baseline for Phase 0. Do not overwrite SSOT via legacy generator. Product-confirmed new terms land only after Phase 1+ with --write --from. knownAliasConflicts are deferred to Phase 1 strict resolver (ambiguous).",
  };
}

function printSummary(terms, issues) {
  const counts = countByNs(terms);
  console.log(
    `SSOT: ${terms.length} = bazi ${counts.bazi} + qimen ${counts.qimen} + glyph ${counts.glyph} + zodiac ${counts.zodiac} + ziwei ${counts.ziwei}`,
  );
  console.log(`ns+slug hash: ${nsSlugHash(terms)}`);
  console.log(`content fingerprint: ${contentFingerprint(terms)}`);
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");
  console.log(`validation: ${errors.length} error(s), ${warns.length} warning(s)`);
  for (const i of issues) console.error(`  [${i.level}/${i.code}] ${i.message}`);
  return errors.length === 0;
}

function writeViaTemp(targetPath, contents) {
  const dir = path.dirname(targetPath);
  const tmp = path.join(dir, `.poju-terms-ssot.${process.pid}.${Date.now()}.tmp.ts`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, contents, "utf8");
  if (!contents.includes("export const POJU_TERMS")) {
    fs.unlinkSync(tmp);
    throw new Error("temp emit missing POJU_TERMS export");
  }
  fs.renameSync(tmp, targetPath);
}

function main() {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  if (flags.has("--help")) {
    console.log(`Usage:
  pnpm terms:check
  pnpm terms:generate -- --check
  pnpm terms:generate -- --write --from <approved-terms.json>
  pnpm terms:generate -- --update-baseline`);
    process.exit(0);
  }

  const wantWrite = flags.has("--write");
  const wantCheck =
    flags.has("--check") || (!wantWrite && !flags.has("--update-baseline"));
  const live = extractPojuTermsArray(fs.readFileSync(SSOT_PATH, "utf8"));

  if (flags.has("--update-baseline")) {
    const ok = printSummary(live, validateTerms(live));
    if (!ok) process.exit(1);
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(buildBaseline(live), null, 2)}\n`, "utf8");
    console.log(`Wrote baseline ${path.relative(ROOT, BASELINE_PATH)}`);
    process.exit(0);
  }

  if (wantWrite) {
    if (!opts.from) {
      console.error(
        [
          "",
          "refusing --write without --from <approved-terms.json>",
          "Canonical source remains lib/glossary/pojulife-terms.ts until an approved export is provided.",
          "Use: pnpm terms:generate -- --write --from path/to/approved-terms.json",
          "",
        ].join("\n"),
      );
      process.exit(1);
    }
    const incoming = loadApprovedJson(opts.from);
    // Writes are strict: no silent alias collisions (Phase 1 should resolve before merge).
    const issues = validateTerms(incoming, { strictAlias: true });
    const ok = printSummary(incoming, issues);
    printDiffReport(diffTerms(live, incoming));
    if (!ok) {
      console.error("validation failed — SSOT not written");
      process.exit(1);
    }
    const currentSrc = fs.readFileSync(SSOT_PATH, "utf8");
    const nextSrc = buildSsotSource(currentSrc, incoming);
    if (
      !nextSrc.includes("export const POJU_TERMS") ||
      !nextSrc.includes("export function termOf")
    ) {
      console.error("temp emit failed structural gate — SSOT not written");
      process.exit(1);
    }
    writeViaTemp(SSOT_PATH, nextSrc);
    console.log(`Wrote ${path.relative(ROOT, SSOT_PATH)} after temp validation`);
    process.exit(0);
  }

  if (wantCheck) {
    console.log("\n========== poju-terms-ssot (--check) ==========\n");
    let knownAliasConflictSigs = null;
    if (fs.existsSync(BASELINE_PATH)) {
      const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
      knownAliasConflictSigs = (baseline.knownAliasConflicts || []).map((c) => c.sig);
    }
    const issues = validateTerms(live, { knownAliasConflictSigs });
    const ok = printSummary(live, issues);

    if (fs.existsSync(BASELINE_PATH)) {
      const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
      const hash = nsSlugHash(live);
      const fp = contentFingerprint(live);
      if (baseline.nsSlugHash && baseline.nsSlugHash !== hash) {
        console.error(
          `baseline ns+slug hash drift: baseline=${baseline.nsSlugHash} live=${hash}`,
        );
        console.error(
          "If intentional, re-record with: pnpm terms:generate -- --update-baseline",
        );
        process.exit(1);
      }
      if (baseline.contentFingerprint && baseline.contentFingerprint !== fp) {
        console.warn(
          `baseline content fingerprint drift (definitions/labels changed): baseline=${baseline.contentFingerprint} live=${fp}`,
        );
        console.warn(
          "ns+slug set unchanged. Re-record baseline after intentional SSOT edits.",
        );
      } else {
        console.log("baseline ns+slug hash: OK");
        console.log("baseline content fingerprint: OK");
      }
    } else {
      console.warn(`baseline missing: ${path.relative(ROOT, BASELINE_PATH)}`);
      console.warn("Create with: pnpm terms:generate -- --update-baseline");
    }

    if (!ok) {
      console.error("\nterms:check FAILED\n");
      process.exit(1);
    }
    console.log("\nterms:check PASSED\n");
    process.exit(0);
  }
}

main();
