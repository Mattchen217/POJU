/**
 * 柱位打标 + 审计不查标记内明文 · 守卫
 *   pnpm exec tsx scripts/test-pillar-marking.ts
 */
import fs from "node:fs";
import path from "node:path";
import { wrapBarePillars } from "@/lib/llm/sanitize/term-marking";
import {
  auditPaymentLeakResiduals,
  applyComplianceSanitize,
} from "@/lib/llm/sanitize/compliance-terms";
import { pojuTermByTraditional } from "@/lib/glossary/pojulife-terms";

const failures: string[] = [];
const assert = (l: string, ok: boolean) => {
  if (!ok) failures.push(l);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${l}`);
};

function main(): void {
  console.log("\n===== 柱位打标 + 审计 =====\n");

  // ① 四柱位有术语
  for (const [han, zh] of [
    ["年柱", "世络"],
    ["月柱", "时脉"],
    ["日柱", "元核"],
    ["时柱", "隐域"],
  ] as const) {
    const t = pojuTermByTraditional(han, "bazi");
    assert(`「${han}」有术语（${zh}）`, t?.term.zh === zh);
  }

  // ② 裸柱位 → 标记
  const marked = wrapBarePillars("你的时柱藏着潜意识，年柱连接家族。", "zh");
  assert("时柱→pl_hour", marked.includes("⟦t:pl_hour"));
  assert("年柱→pl_year", marked.includes("⟦t:pl_year"));
  assert(
    "打标后无裸「时柱」",
    !/(?<![\u4e00-\u9fff])时柱(?![\u4e00-\u9fff])/.test(marked),
  );

  // ③ 审计：合法标记内明文不算泄漏（这是页面报错的根因）
  assert(
    "⟦t:pl_hour|⟧ 不判 payment_leak",
    auditPaymentLeakResiduals("依据 ⟦t:pl_hour|⟧ 藏创造力。", "zh").length === 0,
  );
  // 模型自造 ⟦t:hour|时柱⟧ 也不该因"标记内的时柱"判漏（交给打标器上游解决）
  assert(
    "⟦t:hour|时柱⟧ 标记内明文不判 payment_leak",
    !auditPaymentLeakResiduals("依据 ⟦t:hour|时柱⟧。", "zh").some(
      (v) => v.label === "payment_leak:时柱",
    ),
  );
  // 但标记【外】真裸露仍要抓
  assert(
    "标记外裸「时柱」仍判漏",
    auditPaymentLeakResiduals("你的时柱决定命运。", "zh").some(
      (v) => v.label === "payment_leak:时柱",
    ),
  );

  // ④ 端到端：交付清洗把裸柱位打掉
  const cleaned = applyComplianceSanitize("这一段看你的时柱。", "zh").text;
  assert(
    "交付清洗后无裸时柱",
    !/(?<![\u4e00-\u9fff])时柱(?![\u4e00-\u9fff])/.test(cleaned) ||
      cleaned.includes("⟦t:pl_hour"),
  );

  // ⑤ 术语总数 167
  const src = fs.readFileSync(
    path.join(process.cwd(), "lib/glossary/pojulife-terms.ts"),
    "utf8",
  );
  const count = (src.match(/slug:\s*"/g) ?? []).length;
  assert(`术语总数 167（实得 ${count}）`, count === 167);

  // ⑥ contact.meta 五语言
  for (const l of ["zh", "en", "es", "de", "fr"]) {
    const m = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), `messages/${l}.json`), "utf8"),
    );
    assert(`${l}: contact.meta.title 存在`, Boolean(m?.contact?.meta?.title));
  }

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 全过。"
        : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}
main();
