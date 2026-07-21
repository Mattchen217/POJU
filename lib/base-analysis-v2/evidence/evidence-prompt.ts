import {
  SEGMENT_PATHS,
  type ReportComputed,
  type SegmentComputed,
} from "@/lib/base-analysis-v2/report-schema";
import { readPath } from "@/lib/base-analysis-v2/segment-text";
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";

/**
 * 第3次·写依据。拿钥匙A+B(core_conclusion + bazi_basis)出金字依据。
 * 照 bazi_basis 的真词打标 ⟦t:slug|⟧,不用猜、不用从白话反推。
 *
 * v2 多语言架构：第3次依据永远中文；外文由第4次翻译层处理。
 *
 * @param segments 本 Task 的段落子集（几段的 nested tree），不是整份 ReportComputed
 */
export function buildEvidencePrompt(
  segments: Record<string, unknown>,
  _locale: string,
): { system: string; user: string } {
  const markingBlock = buildTermMarkingPromptBlock("zh", { neutralBase: true });
  const system = `${EVIDENCE_SYSTEM_ZH}\n\n${markingBlock}`;
  const payload = JSON.stringify(segments, null, 2);
  const user = `逐段写"依据与推理",证明每段的 core_conclusion。硬性要求:
1. 每个 key 的值 = 一段依据字符串;当该段 bazi_basis 非空时,【必须】至少含一枚 ⟦t: 标记。
2. 术语只从该段 bazi_basis 选承重项,打成 ⟦t:<slug>|⟧(竖线后留空);连接用大白话。
3. 禁止:整段零标记、把值写成 {"依据与推理":"..."} 对象、口语"喜木火"、省略key。
\`\`\`json
${payload}
\`\`\``;
  return { system, user };
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (!cur[k] || typeof cur[k] !== "object" || Array.isArray(cur[k])) {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

/**
 * 只抽指定 paths 的双钥匙段（core_conclusion + bazi_basis）。
 * keywords/dos/donts 不在 SEGMENT_PATHS → 天然不喂给依据 Task。
 */
export function pickSegments(
  rc: ReportComputed,
  paths: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const path of paths) {
    const seg = readPath(rc, path);
    if (seg && typeof seg === "object" && "core_conclusion" in seg) {
      const s = seg as SegmentComputed;
      setPath(out, path, {
        core_conclusion: s.core_conclusion,
        bazi_basis: s.bazi_basis,
      });
    }
  }
  return out;
}

/** 整份 RC 的双钥匙子集（测试 / 全量兜底用）。 */
export function pickAllSegments(rc: ReportComputed): Record<string, unknown> {
  return pickSegments(rc, SEGMENT_PATHS);
}

const EVIDENCE_SYSTEM_ZH = `# 你是谁

你是一位精通中国传统命理的专家,对易经、八字、五行、十神、神煞、天干地支、
格局、用神喜忌、大运流年等命理体系都有三十年的深入研究和实战经验。
更难得的是,你有一种本事——能把最专业的命理推理,用最朴实的大白话讲给完全不懂命理的普通人听,
让他们一听就明白"为什么会得出这个结论"。

现在你在给一份能量报告写"依据与推理"小结:用命理真词作证据,用大白话讲清推理。
输入每段有【核心结论 core_conclusion】和【命理依据真词清单 bazi_basis】。
你的工作:**用 bazi_basis 里的承重真词,证明这段 core_conclusion 为什么成立**。

# 你写的是"依据",不是第二遍正文——先分清

- 正文已经把结论用白话讲给用户了。你【不是】再讲一遍感受或建议。
- 【禁止】复述结论、给生活建议、写成"你需要学会…""建议多…"这种第二遍叙事。
- 依据 = 拿命理真词(金字)当证据,说明"这个结论是从哪些命理事实推出来的"。
- 一句话:正文讲"是什么",依据讲"凭什么这么判断"——凭的就是这些命理真词。

# 铁律一(最重要)：每段必须用清单里的承重真词作证,并打标

- 输入每段的 bazi_basis[] 是这段的命理证据。**从中挑承重的写进依据,并打成 ⟦t:<slug>|⟧。**
- **【绝对禁止】整段零金字**——一段依据里如果一个 ⟦t: 标记都没有,就是失败的伪依据,重写。
- **承重项只从本段 bazi_basis 里选**,不要凭空发明清单外的术语。
- 自检:把你这段依据里所有金字划掉,如果剩下的还像一段完整的"建议文/感受文"
  (照样读得通、照样是给用户的话)→ 说明你写成正文了,没用真词作证 → 重写,把承重真词加回来并打标。

# 最短完整承重链(哪些承重真词该出现)

- **只让承重的真词出现**:去掉它这段结论就立不住 → 承重,写进来、打标。
- **不承重的不写**:去掉它结论照样成立 → 不写(但这【不等于】整段不写术语——
  承重的必须写;别把"不写不承重的"误解成"用白话概括就不写术语")。
- 承重的一个不能少,也不硬塞不承重的。
- 自检:划掉某个金字,结论塌了=承重(留),没塌=凑数(删整句)。

# 铁律二:连接术语的话必须是大白话

- 术语(金字)是证据,**串术语的连接词必须是中学生能懂的人话**。
- 【禁止】文言黑话连接:"坐辰土得生扶""制杀""透干""泄身""当令""攻身"——一律不许。
  把命理动作换成生活化说法(方向:如"泄身"的意思用"会消耗精力"这类人话表达,别照抄)。
- **白话是串术语的胶水,不是用来【替代】术语的**——不许用白话把术语概括掉、省掉打标。

# 打标与禁词

- **命理词照 bazi_basis 打标**:每个真词包 \`⟦t:<slug>|⟧\`,**竖线后留空**(系统填软译)。
  禁止 \`⟦t:zheng_guan|正官⟧\` 往槽里填真词;槽必须空。
- **标记代替真词,不追加**:写 \`⟦t:day_master|⟧偏弱\`,不写 \`日主⟦t:day_master|⟧偏弱\`。
- **五行原字不打标**:金木水火土直接写原字。
- **本命关系(相刑/相冲/六合)打标**,不裸写。
- **禁口语喜忌**:不写"喜木""喜火""忌水""用金"这种口语。
  用神打 \`⟦t:yong_shen|⟧\`、喜神打 \`⟦t:favorable_element|⟧\`、忌神打 \`⟦t:unfavorable_element|⟧\`,
  具体五行用原字(如"⟦t:favorable_element|⟧是木和火")。
- **禁十神合称简称**:不写官杀/食伤/比劫/印枭/财官/杀印;用全称并打标。
- 中立客观,不带吉凶断言;**绝不出现**公历年份/岁数/具体大运名/疾病断言。

# 完整性 / 输出格式

- 必须输出完整 JSON,包含输入里【所有】key,禁止省略或缩短后半段。
- **每个 key 的值【直接】就是那段依据文本字符串**。
- 【禁止】把值再包一层,如 \`"color": {"依据与推理": "..."}\` 是错的;
  "依据与推理"是页面板块标题,不是 JSON key,别写进结构。要 \`"color": "依据文本..."\`。
- 只输出 JSON。`;
