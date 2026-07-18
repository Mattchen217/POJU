/**
 * 报告收尾句 · UI 固定渲染 / 正文剥离
 *   pnpm exec tsx scripts/test-report-closing.ts
 */
import { stripBaseAnalysisClosingLines } from "@/lib/base-analysis/report-closing";
import { parseBaseAnalysisSections } from "@/lib/base-analysis/parse-base-analysis-sections";
import fs from "node:fs";
import path from "node:path";

const failures: string[] = [];
const assert = (l: string, ok: boolean) => {
  if (!ok) failures.push(l);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${l}`);
};

function main(): void {
  console.log("\n===== 报告收尾句 =====\n");

  const withEvidence = `## 什么状态下你最容易突破

正文。

**依据与推理:** 锚点 ⟦t:wood|⟧。这是你的能量配置读数。怎么用它，取决于你自己。`;

  const stripped = stripBaseAnalysisClosingLines(withEvidence);
  assert("剥掉依据块内收尾句", !stripped.includes("能量配置读数"));
  assert("保留依据块", stripped.includes("依据与推理"));

  const sections = parseBaseAnalysisSections(stripped);
  const last = sections[sections.length - 1];
  assert("最后一节不再含收尾句", !last?.body.includes("取决于你自己"));

  const view = fs.readFileSync(
    path.join(process.cwd(), "components/base-analysis/BaseAnalysisDeliveryView.tsx"),
    "utf8",
  );
  assert("DeliveryView 渲染 closing", view.includes('t("closing")'));
  assert("DeliveryView 剥离模型收尾", view.includes("stripBaseAnalysisClosingLines"));

  const zh = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages/zh.json"), "utf8"),
  );
  assert(
    "zh closing 文案",
    zh?.base_analysis_view?.closing?.includes("能量配置读数"),
  );

  const prompt = fs.readFileSync(
    path.join(process.cwd(), "lib/llm/prompts/base-analysis-stream-prompt.ts"),
    "utf8",
  );
  assert("提示词禁止模型写收尾", prompt.includes("模型勿写") || prompt.includes("do not write"));
  assert("提示词仍提及规范句（防不是命定陷阱）", prompt.includes("取决于你自己"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 全过。"
        : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}
main();
