/**
 * 清洗链保换行 · 守卫
 *   pnpm exec tsx scripts/test-sanitize-preserves-newlines.ts
 *
 * 守 2026-07-17:/\s{2,}/ 把整篇拍成一行 → repair-violations(行级编辑器)拿到整篇当"一行"
 * → max_tokens:1400 截断 → 残篇覆盖完整报告 → 页面停在半句话。
 */
import fs from "node:fs";
import path from "node:path";
import { applyComplianceSanitize } from "@/lib/llm/sanitize/compliance-terms";
import { wrapBareStemElements } from "@/lib/llm/sanitize/term-marking";

const failures: string[] = [];
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
};

const SAMPLE = `你的核心能量像一把精雕的细刃。

## 你的核心配置（强项）

### 精工出细活

**你的内在驱动力:** 你有一股与生俱来的秩序感。

> **你的精工模式:** 你的产出靠精度。

**依据与推理:** 核心特质 ⟦t:day_master|⟧ 得到 ⟦t:zheng_yin|⟧ 生助。`;

function main(): void {
  console.log("\n===== 清洗链 · 保换行 + stem 确定性替换 =====\n");

  // ① 换行必须活着
  const before = SAMPLE.split("\n").length;
  const after = applyComplianceSanitize(SAMPLE, "zh").text.split("\n").length;
  console.log(`  · 清洗前 ${before} 行 → 清洗后 ${after} 行`);
  assert("清洗不吃换行", after >= before - 1);
  assert("repair 能按行切(>2 行)", after > 2);

  // ② 段落分隔(\n\n)必须活着
  assert("段落分隔保留", applyComplianceSanitize(SAMPLE, "zh").text.includes("\n\n"));

  // ③ 横向空白仍然并(原意保留)
  assert("横向空白仍并", applyComplianceSanitize("abc    def", "zh").text.includes("abc def"));

  // ④ 「辛金」必须被代码修掉,不许烧 LLM
  const stem = wrapBareStemElements("核心特质辛金与规则的组合，乙木需要滋养。", "zh");
  assert("辛金 → 标记", stem.includes("⟦t:stem_xin"));
  assert("乙木 → 标记", stem.includes("⟦t:stem_yi"));
  assert("裸干支不再裸露", !/(?<![\u4e00-\u9fff])辛金(?![\u4e00-\u9fff])/.test(stem));
  const full = applyComplianceSanitize("核心特质辛金与规则的组合。", "zh").text;
  assert("交付清洗链已接上 wrapStems", full.includes("⟦t:stem_xin") || !full.includes("辛金"));

  // ⑤ 源码守卫:别再长回来
  for (const [f, fn] of [
    ["lib/llm/sanitize/compliance-terms.ts", "replaceStandaloneRedlines/filterDeletedTermsBounded"],
    ["lib/llm/sanitize/term-marking.ts", "stripLeakedMarkerPlainFromBody/cleanupAfterOutOfSetStrip"],
  ] as const) {
    const src = read(f);
    // :189 的 snippet 提取器允许用 \s+，其余不许
    const bad = [...src.matchAll(/\.replace\(\/\\s\{2,\}\/g/g)].length;
    assert(`${fn} 里没有 /\\s{2,}/(实得 ${bad} 处)`, bad === 0);
  }

  // ⑥ repair 守卫在
  const rp = read("lib/base-analysis/repair-violations.ts");
  assert("repair 拒绝截断结果", rp.includes('finish_reason === "length"'));
  assert("repair 拒绝非行级输入", rp.includes("repair_input_not_line_split"));

  console.log("\n" + (failures.length === 0 ? "✅ 全过。" : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`));
  if (failures.length) process.exit(1);
}

main();
