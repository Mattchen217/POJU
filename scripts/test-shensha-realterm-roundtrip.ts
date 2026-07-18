/**
 * 神煞真词真算 · 往返守卫
 *   pnpm exec tsx scripts/test-shensha-realterm-roundtrip.ts
 *
 * 守：真词进（天乙贵人）→ SSOT 查得到 → 输出端能软译回金字；红线词不进；别名不误丢。
 */
import fs from "node:fs";
import path from "node:path";
import { pojuTermByTraditional } from "@/lib/glossary/pojulife-terms";
import { normalizeShenshaName } from "@/lib/poju/shensha-alias";
import { autoMarkBareTerms } from "@/lib/llm/sanitize/term-marking";
import { OUT_OF_SET_FORBIDDEN_HAN } from "@/lib/glossary/term-closed-set";
import {
  buildCoreJudgmentsRefsFromStructured,
  softMarkCoreJudgmentsRefs,
} from "@/lib/base-analysis/core-judgments";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

const failures: string[] = [];
const assert = (l: string, ok: boolean) => {
  if (!ok) failures.push(l);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${l}`);
};

function main(): void {
  console.log("\n===== 神煞 · 真词真算往返 =====\n");

  // ① 引擎的全部中性神煞，SSOT 都查得到（本名或别名）
  const engineNeutral = [
    "天乙贵人",
    "文昌贵人",
    "天德合",
    "月德合",
    "国印贵人",
    "红艳煞",
    "披麻",
    "天厨贵人",
    "德秀贵人",
    "金神",
    "天赦日",
    "正学堂",
    "羊刃",
  ];
  for (const han of engineNeutral) {
    const t =
      pojuTermByTraditional(han, "bazi") ??
      pojuTermByTraditional(normalizeShenshaName(han), "bazi") ??
      pojuTermByTraditional(normalizeShenshaName(han));
    assert(`「${han}」查得到软译${t ? "（" + t.term.zh + "）" : ""}`, Boolean(t));
  }

  // ② 输出端：真词能打标成金字
  const marked = autoMarkBareTerms("你受天乙贵人提携，本命有刑的张力。", "zh");
  assert("天乙贵人→标记", marked.includes("⟦t:tian_yi_gui_ren"));
  assert("刑→标记或天乙已标", marked.includes("⟦t:"));
  assert("打标后无裸「天乙贵人」", !marked.includes("天乙贵人"));

  // ②b refs 形态：刑@year-day 的 kind 段能打标
  const relMarked = softMarkCoreJudgmentsRefs(
    {
      day_master: "甲",
      strength: "身弱",
      yong_shen: "木",
      xi_shen: [],
      ji_shen: [],
      pattern: "",
      da_yun_step: null,
      shensha_instances: ["天乙贵人"],
      natal_relations: ["刑@year-day"],
    },
    "zh",
  );
  assert("refs 神煞打标", relMarked.shensha_instances[0]!.includes("⟦t:tian_yi_gui_ren"));
  assert("refs 关系 kind 打标", relMarked.natal_relations[0]!.includes("⟦t:xing"));
  assert("refs 位置保留", relMarked.natal_relations[0]!.includes("@year-day"));

  // ③ 天厨 已不在黑名单（否则你补的术语被吃）
  assert(
    "天厨 移出黑名单",
    !(OUT_OF_SET_FORBIDDEN_HAN as readonly string[]).includes("天厨"),
  );

  // ④ 红线词仍在黑名单（不喂真算）
  for (const red of ["十恶大败", "孤鸾煞", "勾绞煞", "童子煞", "空亡", "血刃"]) {
    assert(
      `红线「${red}」在黑名单`,
      (OUT_OF_SET_FORBIDDEN_HAN as readonly string[]).some(
        (b) => red === b || red.includes(b),
      ),
    );
  }

  // ⑤ 术语总数 163
  const t = fs.readFileSync(
    path.join(process.cwd(), "lib/glossary/pojulife-terms.ts"),
    "utf8",
  );
  const count = (t.match(/slug:\s*"/g) ?? []).length;
  assert(`术语总数 163（实得 ${count}）`, count === 163);

  // ⑥ 喂真词：desensitize 后 refs 含真词而非软译「提携」
  // 最小 structured 不够触发引擎神煞时，至少保证别名归一后 push 的是 han 不是 soft
  const pillar = (shen_sha: string[]) => ({
    stem: "甲",
    branch: "子",
    ten_god: "比肩",
    shen_sha,
    hidden_stems: [] as string[],
    life_stage: "临官",
    ganzhi: "甲子",
  });
  const fake = {
    day_master: "甲",
    strength: "身弱",
    yong_shen: "木",
    xi_shen: [] as string[],
    ji_shen: [] as string[],
    pattern: "",
    da_yun: [],
    four_pillars: { year: "甲子", month: "甲子", day: "甲子", hour: "甲子" },
    pillars_detail: {
      year: pillar(["文昌贵人", "十恶大败"]),
      month: pillar([]),
      day: pillar(["天乙贵人"]),
      hour: pillar([]),
    },
  } as unknown as ProfileStructured;
  const refs = buildCoreJudgmentsRefsFromStructured(fake);
  assert(
    "refs 喂真词「天乙贵人」",
    refs.shensha_instances.includes("天乙贵人"),
  );
  assert(
    "refs 喂真词「文昌贵人」(别名不误丢)",
    refs.shensha_instances.includes("文昌贵人"),
  );
  assert("refs 不喂软译「提携」", !refs.shensha_instances.includes("提携"));
  assert(
    "红线「十恶大败」不进 refs",
    !refs.shensha_instances.some((s) => s.includes("十恶")),
  );

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ 全过。"
        : `❌ ${failures.length} 项失败：\n  - ${failures.join("\n  - ")}`),
  );
  if (failures.length) process.exit(1);
}
main();
