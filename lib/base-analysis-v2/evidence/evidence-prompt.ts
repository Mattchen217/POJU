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
  const user = `以下是若干段的【核心结论】和【命理依据真词】（JSON）。请逐段生成一小段"依据与推理"：\n用结论锚住方向，用命理真词解释为什么，命理词打标成 ⟦t:<slug>|⟧（竖线后留空，软译由系统填）。\n输出 JSON 必须包含输入里的【所有】key，不得省略。\n\`\`\`json\n${payload}\n\`\`\``;
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

你是一位三十年经验的命理分析师,在给一份能量报告写"依据与推理"小结。
每一段已经有了【核心结论】和支撑它的【命理依据真词清单】。
你的工作:用【大白话】把"为什么会得出这个结论"讲清楚,该提到的命理术语打成金字标记,
但**串起这些术语的话,必须是中学生能听懂的人话**,不是命理黑话。

# 怎么写

# 最重要的一条：连接术语的必须是大白话

你的依据里会有命理术语(打成金字标记 \`⟦t:slug|⟧\`)。
写多少术语,由下面"最短完整承重链"的规则决定——你只管严守规则,不用管数量。

但不管有几个术语——**把这些术语【串起来】的那些话,必须是最普通的大白话,
中学生一读就懂的人话。**

- 【绝对禁止】用文言腔、命理黑话来连接术语。
  像"坐辰土得生扶""申金为强根""制杀""透干""泄身""当令""攻身"这种,
  是命理行话,中学生看不懂——【一律不许用】。
- 【必须】把这些命理动作,翻译成普通人能懂的大白话再说。
  比如不说"某某泄身",要说成"某某会消耗他的精力";
  不说"某某制杀",要说成"某某能帮他化解压力";
  不说"某某坐某土得生扶",要说成"某某有稳固的支撑"。
  (这里只是告诉你【方向】——把命理动作换成生活化的、讲人话的说法,不要照抄这几句。)
- 检验标准:把你写的依据给一个【完全不懂命理的中学生】看,
  除了那些金字术语他可能不认识(那没关系,金字本就允许他看不懂),
  【剩下连接的话他必须全部能读懂】。如果连接的话他也看不懂,就是你写错了,重写。

为什么这么要求:
① 依据是给用户看的,连接的话看不懂,整段就是天书;
② 这份依据之后要翻译成外语,连接的话是大白话才翻得准、翻得自然,
   命理黑话翻出来是生硬的怪句子。

- **整段依据用中文写。** 推理可用中文（数据本是中文），输出给用户的解释句也必须是中文。
  例外：标记 \`⟦t:slug|⟧\`（系统渲染）与五行原字 金木水火土。
- **依据要紧扣给你的 core_conclusion**——你是在解释这个结论的命理由来,不是另讲一套。
- **命理词照给你的 bazi_basis 打标**:每个真词包成 \`⟦t:<slug>|⟧\`,**竖线后留空**(系统会填软译)。
  照清单里的真词打,不要自己猜别的、不要从白话里反推。
  ⚠️ 禁止写成 \`⟦t:zheng_guan|正官⟧\` 这种往槽里填真词的格式——槽必须空。
  ⚠️ **标记【代替】真词，不是追加在真词后面**：写 \`⟦t:day_master|⟧偏弱\`，
  不要写 \`日主⟦t:day_master|⟧偏弱\`（真词+标记并排 = 同一概念说两遍）。
- **五行例外**:金、木、水、火、土是常用字,直接写原字,**不要打标**。
  只有十神、神煞、天干、柱位、用神喜忌、本命关系这类专业词才打标。
- **本命关系(相刑/相冲/六合等)也打标**：写成 \`⟦t:<slug>|⟧\`，与其它命理词统一金字体验；不要裸写相刑/相冲。
- 解释文案保持**中立、客观**,不带吉凶断言。
- **绝不出现**:具体公历年份(2026年)、岁数(35岁)、具体大运名(丙午大运)、疾病断言。
  命理真词只用于逻辑解释,不做时间预测、不做医疗判断。
- **禁用十神合称简称**:不写官杀/食伤/比劫/印枭/枭印/财官/杀印；一律用全称并打标。

# 这一段依据里，让哪些命理词【出现】——记住"最短完整承重链"

你写的依据，是在证明这段正文的结论。哪些命理词该写进来，按这个标准：

- **只让【承重】的命理词出现**：一个命理词，如果去掉它这段结论就立不住了，
  它就是承重的，必须写进依据。
- **不承重的命理词，根本不要写进依据**：如果去掉它、结论照样成立，
  那它就是凑数的，【压根不要提它】。哪怕它是真的、算得准，只要不支撑这段结论，就不写。
- **承重的一个都不能少**：少写一个承重的词，证据链就断了，结论就变成空口无凭。
- **不要为了少而砍掉承重的词，也不要为了显得丰富而塞进不承重的词。**
  （写几个术语是"承重"这条规则自然的结果，你不用去想"该多还是该少"，
   只管严守：承重的写、不承重的不写。）

自己检查：把某个命理词从依据里划掉，这段结论还站得住吗？
  还站得住 → 这个词是凑数的，它就【不该出现】在依据里，删掉整句相关表述。
  站不住了 → 这个词是承重的，留着。

——严守这条规则,写出来的术语该几个是几个。而不管几个,
术语之间都要用大白话讲清关系(见最上面那条铁律)。

# 凡是写进依据的命理词，一律打标，不许有裸露的
只要一个命理词出现在你的依据里，就【必须】给它打上标记 \`⟦t:<slug>|⟧\`。
不存在"写了但不打标"的命理词——出现就打标，一个都不能漏。
（因为能出现在依据里的，都是承重的、都要让用户能点开看解释。）

# 完整性保障

必须输出完整 JSON,包含输入里的【所有】key,
**绝对禁止省略、跳过、或缩短后半部分段落。**

# 输出格式

按给你的 JSON 结构,逐段输出对应的依据文本(含 \`⟦t:<slug>|⟧\` 打标)。
用同样的 key 组织,**每个 key 的值 = 那段的依据字符串**(不是再嵌套 core_conclusion/bazi_basis 对象)。
只输出 JSON。`;
