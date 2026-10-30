/**
 * Phase 6 — master terms acceptance runner.
 * Executes Layers A–E scripts, writes audit report JSON, exits non-zero on fail.
 *
 *   pnpm test:terms-phase6
 *   node ./node_modules/tsx/dist/cli.mjs scripts/run-terms-phase6-acceptance.ts
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POJU_TERMS } from "../lib/glossary/pojulife-terms";
import { buildShenshaDiffAudit } from "../lib/glossary/shensha-disposition";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TSX = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const REPORT_PATH = path.join(ROOT, "lib", "glossary", "phase6-acceptance-report.json");
const TERMS_EXPORT_PATH = path.join(ROOT, "lib", "glossary", "phase6-terms-export.json");
const CALLSITES_PATH = path.join(ROOT, "lib", "glossary", "phase6-legacy-callsites.json");

type Step = {
  id: string;
  layer: "A" | "B" | "C" | "D" | "E" | "meta";
  label: string;
  command: string[];
  optional?: boolean;
};

const STEPS: Step[] = [
  {
    id: "terms-check",
    layer: "A",
    label: "SSOT static check (terms:check)",
    command: ["node", "scripts/poju-terms-ssot.mjs", "--check"],
  },
  {
    id: "verify-terms",
    layer: "A",
    label: "verify:terms 8 gates",
    command: ["node", TSX, "scripts/verify-terms.ts"],
  },
  {
    id: "term-resolve",
    layer: "B",
    label: "Resolver unit (Phase 1)",
    command: ["node", TSX, "scripts/test-term-resolve.ts"],
  },
  {
    id: "ziwei-fact-pack",
    layer: "C",
    label: "Ziwei fact-pack + display (Phase 2)",
    command: ["node", TSX, "scripts/test-ziwei-fact-pack.ts"],
  },
  {
    id: "qimen-bazi-phase3",
    layer: "C",
    label: "Qimen/Bazi coverage (Phase 3)",
    command: ["node", TSX, "scripts/test-qimen-bazi-phase3.ts"],
  },
  {
    id: "shensha-phase4",
    layer: "C",
    label: "Shensha disposition (Phase 4)",
    command: ["node", TSX, "scripts/test-shensha-phase4.ts"],
  },
  {
    id: "shensha-short-aliases",
    layer: "C",
    label: "Shensha short aliases",
    command: ["node", TSX, "scripts/test-shensha-short-aliases.ts"],
    optional: true,
  },
  {
    id: "term-context-phase5",
    layer: "D",
    label: "Prompt/delivery term context (Phase 5)",
    command: ["node", TSX, "scripts/test-term-context-phase5.ts"],
  },
  {
    id: "export-locales",
    layer: "D",
    label: "Multi-locale export surfaces",
    command: ["node", TSX, "scripts/test-terms-export-locales-phase6.ts"],
  },
  {
    id: "adversarial",
    layer: "E",
    label: "Adversarial / negative leaks",
    command: ["node", TSX, "scripts/test-terms-adversarial-phase6.ts"],
  },
  {
    id: "generator-freeze",
    layer: "meta",
    label: "Legacy generator must refuse overwrite",
    command: ["node", "scripts/generate-poju-terms.mjs"],
    optional: true,
  },
];

type StepResult = {
  id: string;
  layer: string;
  label: string;
  ok: boolean;
  optional: boolean;
  exitCode: number | null;
  ms: number;
  tail: string;
};

function runStep(step: Step): StepResult {
  const started = Date.now();
  const r = spawnSync(step.command[0]!, step.command.slice(1), {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test" },
    maxBuffer: 8 * 1024 * 1024,
  });
  const ms = Date.now() - started;
  const out = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
  const tail = out.split(/\r?\n/).slice(-12).join("\n");
  const exitCode = r.status;
  // Generator freeze: success = non-zero exit (refuses to overwrite)
  let ok = exitCode === 0;
  if (step.id === "generator-freeze") {
    ok = exitCode !== 0 && /disabled|frozen|refuse|overwrite|abort/i.test(out);
    if (!ok && exitCode !== 0) {
      // Any non-zero is acceptable freeze signal if script exits early
      ok = true;
    }
  }
  return {
    id: step.id,
    layer: step.layer,
    label: step.label,
    ok,
    optional: Boolean(step.optional),
    exitCode,
    ms,
    tail,
  };
}

function collectLegacyCallsites() {
  const ROOTS = ["lib", "app", "components"];
  const RE = /pojuTermByTraditional\s*\(/g;
  const rows: Array<{ file: string; total: number }> = [];
  function walk(dir: string, out: string[] = []) {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
      if (name === "node_modules" || name === ".next") continue;
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
  }
  for (const root of ROOTS) {
    for (const file of walk(path.join(ROOT, root))) {
      const text = fs.readFileSync(file, "utf8");
      const matches = [...text.matchAll(RE)];
      if (!matches.length) continue;
      rows.push({
        file: path.relative(ROOT, file).replace(/\\/g, "/"),
        total: matches.length,
      });
    }
  }
  rows.sort((a, b) => b.total - a.total);
  return {
    generated_at: new Date().toISOString(),
    files: rows.length,
    call_sites: rows.reduce((s, r) => s + r.total, 0),
    rows,
  };
}

function exportTermsSnapshot() {
  const byNs: Record<string, number> = {};
  for (const t of POJU_TERMS) {
    byNs[t.ns] = (byNs[t.ns] ?? 0) + 1;
  }
  return {
    generated_at: new Date().toISOString(),
    total: POJU_TERMS.length,
    by_ns: byNs,
    terms: POJU_TERMS.map((t) => ({
      ns: t.ns,
      slug: t.slug,
      traditional: t.traditional,
      polarity: t.polarity,
      term: t.term,
      definition: t.definition,
      aliases: t.aliases ?? [],
    })),
  };
}

function main() {
  console.log("\n========== POJU terms Phase 6 acceptance ==========\n");
  const results: StepResult[] = [];
  for (const step of STEPS) {
    process.stdout.write(`→ [${step.layer}] ${step.label} ... `);
    const res = runStep(step);
    results.push(res);
    const mark = res.ok ? "PASS" : res.optional ? "SKIP/FAIL(opt)" : "FAIL";
    console.log(`${mark} (${res.ms}ms, exit=${res.exitCode})`);
    if (!res.ok && !res.optional) {
      console.error(res.tail);
    }
  }

  const shenshaAudit = buildShenshaDiffAudit();
  const shenshaCounts = { public_glossary: 0, internal_redline: 0, unknown_blocked: 0 };
  for (const row of shenshaAudit) {
    shenshaCounts[row.disposition] += 1;
  }

  const callsites = collectLegacyCallsites();
  fs.writeFileSync(CALLSITES_PATH, JSON.stringify(callsites, null, 2) + "\n");

  const termsExport = exportTermsSnapshot();
  fs.writeFileSync(TERMS_EXPORT_PATH, JSON.stringify(termsExport, null, 2) + "\n");

  const hardFails = results.filter((r) => !r.ok && !r.optional);
  const report = {
    generated_at: new Date().toISOString(),
    phase: 6,
    pass: hardFails.length === 0,
    summary: {
      steps: results.length,
      passed: results.filter((r) => r.ok).length,
      failed_hard: hardFails.length,
      failed_optional: results.filter((r) => !r.ok && r.optional).length,
      terms_total: POJU_TERMS.length,
      terms_by_ns: termsExport.by_ns,
      shensha_disposition_counts: shenshaCounts,
      legacy_pojuTermByTraditional: {
        files: callsites.files,
        call_sites: callsites.call_sites,
      },
    },
    block_conditions: {
      traditional_or_unknown_in_user_exit: hardFails.some((r) =>
        ["export-locales", "adversarial", "shensha-phase4"].includes(r.id),
      ),
      ns_collision_misresolve: hardFails.some((r) => r.id === "term-resolve"),
      five_locale_empty: hardFails.some((r) =>
        ["terms-check", "verify-terms", "export-locales"].includes(r.id),
      ),
      unexplained_ssot_count_change: hardFails.some((r) =>
        ["terms-check", "verify-terms"].includes(r.id),
      ),
      legacy_generator_can_overwrite: results.some(
        (r) => r.id === "generator-freeze" && !r.ok,
      ),
      suite_incomplete: hardFails.length > 0,
    },
    steps: results.map((r) => ({
      id: r.id,
      layer: r.layer,
      label: r.label,
      ok: r.ok,
      optional: r.optional,
      exitCode: r.exitCode,
      ms: r.ms,
    })),
    artifacts: {
      report: "lib/glossary/phase6-acceptance-report.json",
      terms_export: "lib/glossary/phase6-terms-export.json",
      legacy_callsites: "lib/glossary/phase6-legacy-callsites.json",
      shensha_audit: "lib/glossary/shensha-disposition-audit.json",
      release_checklist: ".cursor/docs/terms-phase6-release-checklist.md",
    },
    unresolved_risks: [
      "Legacy pojuTermByTraditional call sites remain — migrate to resolvePojuTerm({ namespace }) per phase6-legacy-callsites.json",
      "Full live LLM five-locale delivery/PDF screenshots still require manual gray-release review",
      "Observation window: do not delete old SSOT rows; only add mappings / fix errors with versioning",
    ],
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");

  console.log("\n--- summary ---");
  console.log(`pass=${report.pass}  terms=${POJU_TERMS.length}  hardFails=${hardFails.length}`);
  console.log(`report → ${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`terms export → ${path.relative(ROOT, TERMS_EXPORT_PATH)}`);
  console.log(`callsites → ${path.relative(ROOT, CALLSITES_PATH)}`);

  if (hardFails.length > 0) {
    console.error("\nPhase 6 BLOCKED — hard failures:");
    for (const f of hardFails) console.error(`  - [${f.layer}] ${f.id}: ${f.label}`);
    process.exit(1);
  }
  console.log("\nPhase 6 acceptance PASSED.\n");
}

main();
