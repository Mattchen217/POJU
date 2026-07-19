/**
 * 正文禁「」 · 守卫
 *   pnpm exec tsx scripts/test-body-no-corner-quotes.ts
 */
import fs from "node:fs";
import path from "node:path";
import { prepareBodyTextForGlossaryRender } from "@/lib/llm/sanitize/compliance-terms";

const failures: string[] = [];
const read = (r: string) => fs.readFileSync(path.join(process.cwd(), r), "utf8");
const assert = (l: string, ok: boolean) => {
  if (!ok) failures.push(l);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${l}`);
};

function main(): void {
  console.log("\n===== 正文禁「」=====\n");

  // ① 正文层剥「」（doc48 实例）
  const body =
    "真正的优势在于「精准释放」：把力气用在最值得的地方。找到它的「水」与「木」。";
  const out = prepareBodyTextForGlossaryRender(body, "zh");
  assert("正文无「」", !out.includes("「") && !out.includes("」"));
  assert("内容保留（精准释放）", out.includes("精准释放"));
  assert("内容保留（水/木）", out.includes("水") && out.includes("木"));

  // ② 提示词已清理
  const p = read("lib/llm/prompts/base-analysis-stream-prompt.ts");
  assert(
    "提示词有正文禁用规则",
    p.includes("正文禁用") || p.includes("不要给任何词加"),
  );
  // 五行/十神不再用「」框
  assert("不再有 不写「木」", !p.includes("不写「木」"));
  assert("不再有 不写「食神」", !p.includes("不写「食神」"));
  // 正例已删
  assert("✓ 正例已删（增加…更稳）", !p.includes("的滋养让"));
  assert("✓ 正例已删（以…换取）", !p.includes("换取 `⟦t:pian_cai"));
  // 产出物名换《》
  assert("产出物名用《》", p.includes("《个人能量分析报告》"));

  // ③ 提示词里残留的「」应该很少
  const remain = (p.match(/「[^」]*」/g) ?? []).length;
  console.log(
    `  · 提示词残留「」数量: ${remain}（目标：尽量少，功能性的已换反引号/《》）`,
  );
  assert("提示词「」大幅减少（≤3）", remain <= 3);

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 全过。"
        : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}
main();
