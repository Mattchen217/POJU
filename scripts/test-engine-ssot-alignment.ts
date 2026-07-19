/**
 * 引擎输出词 ⊆ SSOT · 对齐守卫
 *   pnpm exec tsx scripts/test-engine-ssot-alignment.ts
 *
 * 存在理由：payment_leak 从 时柱→月柱→相刑，每次修一个词都是打地鼠。
 * 这个守卫遍历引擎【所有可能输出的词】，每个都必须能被 SSOT（traditional 或 aliases）软译回来，
 * 或明确在红线黑名单里。缺一个 → 测试红 → 上线前发现，不在用户面前炸。
 */
import fs from "node:fs";
import path from "node:path";
import { pojuTermByTraditional } from "@/lib/glossary/pojulife-terms";
import { OUT_OF_SET_FORBIDDEN_HAN } from "@/lib/glossary/term-closed-set";
import { wrapBareRelations } from "@/lib/llm/sanitize/term-marking";
import { hasCoreJudgmentsRedline } from "@/lib/base-analysis/generate-core-judgments";

const failures: string[] = [];
const assert = (l: string, ok: boolean) => {
  if (!ok) failures.push(l);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${l}`);
};

// 引擎可能输出的所有中性词（关系词根 + 神煞 + 十神 + 柱位 + 结构 + 天干五行）
const ENGINE_WORDS = [
  // 关系词根（引擎变体，含带"相"）
  "相刑",
  "三刑",
  "相冲",
  "六冲",
  "相害",
  "六害",
  "相合",
  "六合",
  "半合",
  "三合",
  "合化",
  // 神煞（全 51，红线的会被下方红线判定放行）
  "天乙贵人",
  "禄神",
  "飞刃",
  "羊刃",
  "文昌",
  "文昌贵人",
  "桃花",
  "驿马",
  "华盖",
  "孤辰",
  "寡宿",
  "金舆",
  "天德贵人",
  "天德合",
  "月德贵人",
  "月德合",
  "德秀贵人",
  "福星贵人",
  "太极贵人",
  "国印贵人",
  "天厨贵人",
  "将星",
  "劫煞",
  "亡神",
  "灾煞",
  "天喜",
  "天医",
  "红鸾",
  "红艳煞",
  "披麻",
  "金神",
  "天赦日",
  "词馆",
  "正学堂",
  // 十神
  "比肩",
  "劫财",
  "食神",
  "伤官",
  "偏财",
  "正财",
  "七杀",
  "正官",
  "偏印",
  "正印",
  // 柱位 + 干支拆解 + 结构
  "年柱",
  "月柱",
  "日柱",
  "时柱",
  "年干",
  "月干",
  "日干",
  "时干",
  "年支",
  "月支",
  "日支",
  "时支",
  "主星",
  "副星",
  "通根",
  "透干",
  "坐支",
  "坐干",
  "本氣",
  "本气",
  "中氣",
  "中气",
  "余氣",
  "余气",
  "干支",
  "干合",
  "支合",
  "調候",
  "调候",
  "納音",
  "纳音",
  "墓庫",
  "墓库",
  "小運",
  "小运",
  "流月",
  "流日",
  "流時",
  "流时",
  "真太陽時",
  "真太阳时",
  "夫妻星",
  "配偶星",
  "日主",
  "大运",
  "流年",
  "命盘",
  "命局",
  "八字",
  "四柱",
  "用神",
  "喜神",
  "忌神",
  "天干",
  "地支",
  "藏干",
  "身弱",
  "身强",
  "身旺",
  // 五行 + 天干
  "木",
  "火",
  "土",
  "金",
  "水",
  "甲",
  "乙",
  "丙",
  "丁",
  "戊",
  "己",
  "庚",
  "辛",
  "壬",
  "癸",
];

const isRedline = (w: string) =>
  (OUT_OF_SET_FORBIDDEN_HAN as readonly string[]).some((b) => w === b || w.includes(b));

function main(): void {
  console.log("\n===== 引擎输出词 ⊆ SSOT 对齐 =====\n");
  const gaps: string[] = [];
  for (const w of ENGINE_WORDS) {
    if (isRedline(w)) continue;
    const t = pojuTermByTraditional(w, "bazi") ?? pojuTermByTraditional(w);
    if (!t) gaps.push(w);
  }
  assert(
    `所有引擎中性词都能软译（缺口：${gaps.join(" ") || "无"}）`,
    gaps.length === 0,
  );

  // 抽查别名确实生效（身强 slug = strong_self）
  for (const [alias, expectSlug] of [
    ["相刑", "xing"],
    ["相冲", "chong"],
    ["文昌贵人", "wen_chang"],
    ["身旺", "strong_self"],
    ["合化", "rel_transmutation"],
  ] as const) {
    const t = pojuTermByTraditional(alias, "bazi") ?? pojuTermByTraditional(alias);
    assert(
      `「${alias}」→ ${expectSlug}（实得 ${t?.slug ?? "查不到"}）`,
      t?.slug === expectSlug,
    );
  }

  // 关系打标：相刑 → ⟦t:xing|⟧（叙事输出端）；core_judgments 闸只拦恐吓红线
  const relMarked = wrapBareRelations("结构上有相刑的张力。", "zh");
  assert("相刑→⟦t:xing", relMarked.includes("⟦t:xing"));
  assert("打标后无裸相刑", !relMarked.includes("相刑"));
  assert(
    "裸相刑放行（中性真词）",
    !hasCoreJudgmentsRedline("结构上有相刑的张力。"),
  );
  assert("恐吓红线仍拦", hasCoreJudgmentsRedline("此盘有十恶大败"));

  // 术语总数 209
  const src = fs.readFileSync(
    path.join(process.cwd(), "lib/glossary/pojulife-terms.ts"),
    "utf8",
  );
  const count = (src.match(/slug:\s*"/g) ?? []).length;
  assert(`术语总数 209（实得 ${count}）`, count === 209);

  // SHENSHA_ALIAS 第二事实源已清
  const aliasSrc = fs.readFileSync(
    path.join(process.cwd(), "lib/poju/shensha-alias.ts"),
    "utf8",
  );
  assert("SHENSHA_ALIAS 常量已删除", !/\bSHENSHA_ALIAS\b/.test(aliasSrc));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 引擎与 SSOT 完全对齐。"
        : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}
main();
