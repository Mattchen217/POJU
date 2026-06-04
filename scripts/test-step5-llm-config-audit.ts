/**
 * Step 5.1 — audit callLLM-related thinking_effort / max_tokens / call_type in repo.
 * Run: pnpm exec tsx scripts/test-step5-llm-config-audit.ts
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED: Record<
  string,
  { thinking: string; max_tokens: number; call_type?: string }
> = {
  base_analysis: { thinking: "medium", max_tokens: 8000, call_type: "base_analysis" },
  poju_reply: { thinking: "low", max_tokens: 2500, call_type: "poju_reply" },
  syncro_batch: { thinking: "low", max_tokens: 6000, call_type: "syncro_batch" },
  match_report: { thinking: "medium", max_tokens: 10000, call_type: "match_report" },
  glyph_reading: { thinking: "low", max_tokens: 15_000, call_type: "glyph_reading" },
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

type Finding = {
  file: string;
  line: number;
  call_type?: string;
  thinking_effort?: string;
  max_tokens?: number;
};

const findings: Finding[] = [];

for (const file of walk(join(ROOT, "lib"))) {
  scanFile(file);
}
for (const file of walk(join(ROOT, "app", "api"))) {
  scanFile(file);
}

function scanFile(file: string) {
  const rel = file.replace(ROOT + "\\", "").replace(ROOT + "/", "");
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("callLLM") && !lines[i].includes("call_type:")) continue;
    const block = lines.slice(i, Math.min(i + 12, lines.length)).join("\n");
    if (!block.includes("callLLM(") && !block.includes("call_type:")) continue;
    if (!block.includes("call_type")) continue;

    const call_type = block.match(/call_type:\s*["']([^"']+)["']/)?.[1];
    const thinking_effort = block.match(/thinking_effort:\s*["']([^"']+)["']/)?.[1];
    const max_tokens = block.match(/max_tokens:\s*([0-9_]+)/)?.[1]?.replace(/_/g, "");

    if (call_type) {
      findings.push({
        file: rel,
        line: i + 1,
        call_type,
        thinking_effort,
        max_tokens: max_tokens ? Number(max_tokens) : undefined,
      });
    }
  }
}

console.log("\n=== Step 5.1 LLM callLLM audit ===\n");
console.log("| file | line | call_type | thinking | max_tokens | vs expected |");
console.log("|------|------|-----------|----------|------------|-------------|");

const issues: string[] = [];

for (const f of findings) {
  const key =
    f.call_type === "base_analysis"
      ? "base_analysis"
      : f.call_type === "syncro_batch"
        ? "syncro_batch"
        : f.call_type === "match_report"
          ? "match_report"
          : f.call_type === "glyph_reading"
            ? "glyph_reading"
            : f.call_type === "poju_reply" || f.call_type === "collection_flash"
              ? "poju_reply"
              : null;

  const exp = key ? EXPECTED[key] : null;
  let status = "—";
  if (exp) {
    const thinkOk = !f.thinking_effort || f.thinking_effort === exp.thinking;
    const tokOk = !f.max_tokens || f.max_tokens <= exp.max_tokens + 500;
    const high = f.thinking_effort === "high" || f.thinking_effort === "xhigh";
    status = thinkOk && tokOk && !high ? "OK" : "CHECK";
    if (status === "CHECK") {
      issues.push(
        `${f.file}:${f.line} ${f.call_type} thinking=${f.thinking_effort ?? "(router default)"} max_tokens=${f.max_tokens ?? "(default)"}`,
      );
    }
  } else if (f.thinking_effort === "high" || (f.max_tokens && f.max_tokens > 12000)) {
    status = "HIGH";
    issues.push(`${f.file}:${f.line} ${f.call_type} may be oversized`);
  }

  console.log(
    `| ${f.file} | ${f.line} | ${f.call_type} | ${f.thinking_effort ?? "—"} | ${f.max_tokens ?? "—"} | ${status} |`,
  );
}

console.log("\n=== Router defaults (getThinkingConfig) ===");
console.log("deep_analysis → medium (was high)");
console.log("syncro_batch / base_analysis / glyph_reading / match_report / poju_reply → explicit tiers");

if (issues.length) {
  console.log("\n⚠ Items to review:");
  for (const i of issues) console.log("  -", i);
} else {
  console.log("\n✓ No high-thinking / oversized token overrides in audited call sites.");
}

console.log(
  "\nNote: Run base_analysis timing against production with OPENROUTER_API_KEY:",
);
console.log("  pnpm exec tsx scripts/test-base-analysis-timing.ts (if present)");

process.exit(issues.some((i) => i.includes("high")) ? 1 : 0);
