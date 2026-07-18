/**
 * 柱位打标 + 审计不查标记内明文 · 守卫
 *   pnpm exec tsx scripts/test-pillar-marking.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  wrapBarePillars,
  wrapBareRelations,
} from "@/lib/llm/sanitize/term-marking";
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

  // ① 结构系列术语齐全
  for (const [han, zh] of [
    ["年柱", "世络"],
    ["月柱", "时脉"],
    ["日柱", "元核"],
    ["时柱", "隐域"],
    ["年干", "世彰"],
    ["月干", "脉呈"],
    ["日干", "核赋"],
    ["时干", "域微"],
    ["年支", "世蕴"],
    ["月支", "脉囿"],
    ["日支", "核渊"],
    ["时支", "域筑"],
    ["主星", "首枢"],
    ["副星", "底织"],
    ["通根", "深贯"],
    ["透干", "浮见"],
    ["坐支", "凭托"],
    ["坐干", "负冠"],
    ["本氣", "主禀"],
    ["本气", "主禀"],
    ["中氣", "兼含"],
    ["余氣", "余存"],
    ["干支", "时耦"],
    ["干合", "显契"],
    ["支合", "隐契"],
    ["調候", "候谐"],
    ["调候", "候谐"],
    ["納音", "潜弦"],
    ["墓庫", "归匮"],
    ["小運", "纤漪"],
    ["小运", "纤漪"],
    ["流月", "月潮"],
    ["流日", "日轨"],
    ["流時", "辰瞬"],
    ["流时", "辰瞬"],
    ["真太陽時", "曜准"],
    ["真太阳时", "曜准"],
    ["夫妻星", "俪模"],
    ["配偶星", "俪模"],
  ] as const) {
    const t = pojuTermByTraditional(han, "bazi");
    assert(`「${han}」有术语（${zh}）`, t?.term.zh === zh);
  }

  // ② 裸结构词 → 标记
  const marked = wrapBarePillars(
    "你的时柱藏着潜意识，年柱连接家族。月干外露，日支是情感根基。通根有力，透干可见，坐支凭环境。本气最稳，干支成偶。调候与纳音，小运细波，流月起伏，真太阳时校准。",
    "zh",
  );
  assert("时柱→pl_hour", marked.includes("⟦t:pl_hour"));
  assert("年柱→pl_year", marked.includes("⟦t:pl_year"));
  assert("月干→pl_month_stem", marked.includes("⟦t:pl_month_stem"));
  assert("日支→pl_day_branch", marked.includes("⟦t:pl_day_branch"));
  assert("通根→pl_rooting", marked.includes("⟦t:pl_rooting"));
  assert("透干→pl_protrusion", marked.includes("⟦t:pl_protrusion"));
  assert("坐支→pl_stem_on_branch", marked.includes("⟦t:pl_stem_on_branch"));
  assert("本气→comp_main_qi", marked.includes("⟦t:comp_main_qi"));
  assert("干支→rel_stem_branch", marked.includes("⟦t:rel_stem_branch"));
  assert("调候→ch_tiaohou", marked.includes("⟦t:ch_tiaohou"));
  assert("纳音→ch_nayin", marked.includes("⟦t:ch_nayin"));
  assert("小运→tm_xiaoyun", marked.includes("⟦t:tm_xiaoyun"));
  assert("流月→tm_liuyue", marked.includes("⟦t:tm_liuyue"));
  assert(
    "真太阳时→tm_true_solar_time",
    marked.includes("⟦t:tm_true_solar_time"),
  );
  assert(
    "打标后无裸「时柱」",
    !/(?<![\u4e00-\u9fff])时柱(?![\u4e00-\u9fff])/.test(marked),
  );
  assert("打标后无裸「月干」", !marked.includes("月干"));
  assert("打标后无裸「日支」", !marked.includes("日支"));
  assert("打标后无裸「通根」", !marked.includes("通根"));
  assert("打标后无裸「本气」", !marked.includes("本气"));
  assert("打标后无裸「调候」", !marked.includes("调候"));
  assert("打标后无裸「真太阳时」", !marked.includes("真太阳时"));

  // 夫妻星 / 配偶星 → 同一 slug；≠ 配偶宫
  const spouse = wrapBarePillars("命中配偶星清晰，亦称夫妻星；配偶宫另论。", "zh");
  assert("配偶星→ss_spouse_star", spouse.includes("⟦t:ss_spouse_star"));
  assert("夫妻星→ss_spouse_star", spouse.includes("⟦t:ss_spouse_star"));
  assert("打标后无裸配偶星", !spouse.includes("配偶星"));
  assert("打标后无裸夫妻星", !spouse.includes("夫妻星"));
  assert("配偶宫仍保留（≠俪模）", spouse.includes("配偶宫"));

  // 日干 ≠ 日主
  const dayMasterSafe = wrapBarePillars("日主偏弱但日干有力。", "zh");
  assert("「日主」不被打成 pl_day_stem", dayMasterSafe.includes("日主"));
  assert("「日干」→pl_day_stem", dayMasterSafe.includes("⟦t:pl_day_stem"));

  // 坐支 ≠ 日支
  const seat = wrapBarePillars("日干坐支有根。", "zh");
  assert(
    "坐支→pl_stem_on_branch（非整「日支」）",
    seat.includes("⟦t:pl_stem_on_branch"),
  );
  assert("日干仍打标", seat.includes("⟦t:pl_day_stem"));

  // 干合 ≠ 天干合：长词先吃
  const he = wrapBareRelations("天干合与干合、支合各有所指。", "zh");
  assert("天干合→stemhe", he.includes("⟦t:stemhe"));
  assert("干合→rel_stem_harmony", he.includes("⟦t:rel_stem_harmony"));
  assert("支合→rel_branch_harmony", he.includes("⟦t:rel_branch_harmony"));
  assert("打标后无裸天干合", !he.includes("天干合"));
  assert("打标后无裸干合", !he.includes("干合"));

  // ③ 审计：合法标记内明文不算泄漏
  assert(
    "⟦t:pl_hour|⟧ 不判 payment_leak",
    auditPaymentLeakResiduals("依据 ⟦t:pl_hour|⟧ 藏创造力。", "zh").length === 0,
  );
  assert(
    "⟦t:hour|时柱⟧ 标记内明文不判 payment_leak",
    !auditPaymentLeakResiduals("依据 ⟦t:hour|时柱⟧。", "zh").some(
      (v) => v.label === "payment_leak:时柱",
    ),
  );
  assert(
    "标记外裸「时柱」仍判漏",
    auditPaymentLeakResiduals("你的时柱决定命运。", "zh").some(
      (v) => v.label === "payment_leak:时柱",
    ),
  );

  // ④ 端到端
  const cleaned = applyComplianceSanitize("这一段看你的时柱。", "zh").text;
  assert(
    "交付清洗后无裸时柱",
    !/(?<![\u4e00-\u9fff])时柱(?![\u4e00-\u9fff])/.test(cleaned) ||
      cleaned.includes("⟦t:pl_hour"),
  );

  // ⑤ 术语总数 197
  const src = fs.readFileSync(
    path.join(process.cwd(), "lib/glossary/pojulife-terms.ts"),
    "utf8",
  );
  const count = (src.match(/slug:\s*"/g) ?? []).length;
  assert(`术语总数 197（实得 ${count}）`, count === 197);

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
