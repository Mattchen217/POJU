/**
 * 全仓无老软译残留 · 守卫
 *   pnpm exec tsx scripts/test-no-legacy-soft.ts
 *
 * 产品未上线、无历史数据 → 老软译必须 0 残留，只留 SSOT。
 */
import fs from "node:fs";
import path from "node:path";

const LEGACY = [
  "你的能量结构",
  "当前阶段气候",
  "当前这个阶段",
  "当前时空效能",
  "显性特质层",
  "隐性特质层",
  "内在支撑层",
] as const;

/** 营销文案里的「你的能量结构」是正常白话，排除。 */
const EXEMPT = new Set([
  "onboarding-templates.ts",
  "matrix-narrative-text.ts",
  "matrix-narrative-prompt.ts",
]);

const failures: string[] = [];

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".next") continue;
      walkTsFiles(full, out);
    } else if (name.isFile() && /\.tsx?$/.test(name.name)) {
      out.push(full);
    }
  }
  return out;
}

function main(): void {
  console.log("\n===== 无老软译残留 =====\n");
  const libRoot = path.join(process.cwd(), "lib");
  const files = walkTsFiles(libRoot);
  for (const word of LEGACY) {
    const hits: string[] = [];
    for (const file of files) {
      if (EXEMPT.has(path.basename(file))) continue;
      const text = fs.readFileSync(file, "utf8");
      if (text.includes(word)) hits.push(path.relative(process.cwd(), file).replace(/\\/g, "/"));
    }
    const ok = hits.length === 0;
    console.log(`  [${ok ? "PASS" : "FAIL"}] 「${word}」残留: ${ok ? "无" : hits.join(", ")}`);
    if (!ok) failures.push(`${word} → ${hits.join(", ")}`);
  }
  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 老软译已清零。"
        : `❌ 残留:\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}

main();
