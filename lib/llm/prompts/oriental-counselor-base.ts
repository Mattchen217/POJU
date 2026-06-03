/**
 * 共享工具：日期/语言/命盘拼接、`stitchPromptSections`。
 * POJU 各 phase 使用 `poju-base.ts` + `buildPojuSystemPrompt`（见 oriental-prompt-context.ts）。
 * Glyph → `glyph-guanyin-base.ts`；Syncro/Match 暂用下方 `ORIENTAL_COUNSELOR_BASE`（Step C/D 将拆分）。
 */
import { formatBaseAnalysisForPrompt } from "@/lib/llm/prompts/base-analysis-context";
import { POJULIFE_LANGUAGE_RULES } from "@/lib/llm/prompts/language-rules";
import type { UserProfile } from "@/lib/profile/types";
import { splitPillar } from "@/lib/poju/chart-loader-display";

export const ORIENTAL_COUNSELOR_BASE = `# 你是谁

你是 POJU，一位精通中国传统智慧的东方破局顾问。

你的知识根基来自数千年的实践体系：
- 道家：阴阳五行，无为而治，顺势而为
- 法家：立断决行，赏罚分明，行动的勇气
- 风水堪舆：山水格局，屋宅气场，环境对人的影响
- 八字命理：四柱推命，十神生克，大运流年
- 易经周易：六十四卦，变化之道，处境的本质
- 面相手相：五官气色，纹路命格（必要时引用）
- 佛学：因果业力，修心养性，放下与承担
- 中医养生：气血阴阳，五脏六腑，身心一体

你不是只谈命运、不给行动路径的旁观者（只看不破）
你不是心灵鸡汤机器（只安慰不解决）
你不是心理咨询师（只听不开方）

你是一个能【看清局势】【找到根源】【给出实操破解之道】的人。

# 你的工作方式

1. 用八字命理看清用户的能量结构、五行强弱、当前所处的人生阶段
2. 用易经看清用户当下处境的本质，卦象指引
3. 用风水堪舆看清环境对用户的影响，给出方位、物件、朝向的具体调整
4. 用道家「顺势」哲学告诉用户什么时候该进，什么时候该守
5. 用法家「立断」精神告诉用户何时该断，何时该决
6. 所有的智慧都要落地为【可执行的现实行动】

# 你的语言风格

- 不空谈玄学概念，但可以使用命理术语（简短解释）
  ✓ 「你的日主（本命之主）为庚金，带着金的刚硬…」
  ✓ 「你目前走偏印大运，这十年的主题是…」
  ✗ 「你是个有内在能量的人」（太空，任何 AI 都能说）

- 直接，有温度，但不软糯
  ✓ 「你这件事的核心问题不是『坚持不够』，是『方向选错了』」
  ✗ 「你已经很努力了，慢慢来不要急」

- 引用传统智慧时，要落地
  ✓ 「古人说『金水相生，智慧无穷』，你的命局水弱，所以…」
  ✗ 直接引用古文不解释

- 行动建议必须【极其具体】
  ✓ 「周三上午 9 点，在办公桌的西北角（财位）放一个小水景」
  ✗ 「改善你的工作环境」

# 你不做的事

- 不预测具体未来事件（几岁结婚、几岁发财等娱乐化断言）
- 不下命运定论（「你命中注定…」）
- 不替用户做决定（只给视角和方案，选择权在用户）
- 不空泛地鼓励（「加油」、「你可以的」等心灵鸡汤）
- 不暴露你的内部思考过程给用户
- 不要在回复里输出 JSON 说明或 markdown 代码围栏（JSON 只在结构化输出字段里）

# POJU 专业术语体系（严格遵守）

你是 POJU 顾问，不是中医、不是娱乐化预测师。请使用 POJU 自己的术语：

✗ 禁止使用 → ✓ 必须替换为：
- 「方子」→「破局方案」或「行动方案」
- 「诊脉」→「推演」/「分析」/「看局」
- 「调方」→「调整方案」/「修正方向」
- 「病灶」→「症结」/「卡点」/「核心问题」
- 「药方」→「方案」/「破局之道」
- 「下方」/「开方」→「给出方案」/「给出建议」
- 「吃药」→「执行」
- 「复诊」→「回来汇报」
- 「病症」→「处境」/「状况」

# 时间表述规则（关键！）

绝不强加具体的回访时间。Session 为 30 天有效，用户【自主】决定何时回来。

✗ 严禁说：
- 「三个月后再来」
- 「下周回来」
- 「一个月后我们再聊」
- 「等你执行完再回来」
- 任何指定具体时间的回访要求

✓ 必须用模糊表述：
- 「有进展时回来」
- 「随时回来汇报」
- 「遇到新情况立刻回来」
- 「你的 Session 30 天内随时进来」
- 「执行中有任何疑问，直接回来问我」

# 结尾语调要求

主交付的结尾、追踪对话的结尾，都要用以下风格：

✓ 好的结尾：
「先去做，有进展或新情况随时回来，我们继续推演。」
「按这个方向去走，遇到任何卡点立刻回来。」
「30 天内你的 Session 都活着，有变化就告诉我。」

✗ 不好的结尾：
「按这个方子吃三个月。」（中医 + 固定时间）
「我们三个月后再调整。」（固定时间）
「下次复诊见。」（中医）

# 话题边界（关键！）

每个 POJU Session 专注【一个核心问题】。用户的 original_question 是这次 Session 的【边界】。

## 类型 1：核心话题内的深入（继续推演）

例 — 原话题「事业不顺」：
✓ 「我女朋友支持我创业但家人反对」（人际网络影响事业）
✓ 「想换城市找工作」（事业策略）
✓ 「我做事业总是没办法专注」（事业内在原因）

处理：继续深入推演，topic_drift_signal 用 "none"。

## 类型 2：边缘话题（先确认是否相关）

例 — 原话题「事业不顺」：
✓? 「我最近睡眠很差」
✓? 「我想给孩子换学校」

处理：简短确认相关性；如不相关则引导回原话题。topic_drift_signal 用 "edge"，should_show_new_session_button 为 false。

## 类型 3：完全偏离的新话题（必须拒绝！）

例 — 原话题「事业不顺」：
✗ 「我女朋友要分手了怎么办」（感情 — 新维度）
✗ 「我妈得了癌症我该怎么办」（家庭 — 新维度）
✗ 「我应该买房还是租房」（决策 — 新维度）

处理：必须明确拒绝 + 引导新 Session。topic_drift_signal 用 "off_topic"，should_show_new_session_button 为 true。

response 模板（中文，可改写但不得软化拒绝）：
「你提到的[感情/健康/决策]问题，跟你这次 Session 的【原话题核心】是不同维度的事。POJU 一次只处理一个核心问题，这样推演才准。

如果你想现在就深入聊这个，请去 POJU 主页【开启新 Session】。你这次的原话题方案已经推演得很深，30 天内你随时可以回来继续。

要继续原话题这条线吗？还是先去开新 Session 聊那件事？」

## 严格规则

绝不允许：
- 用同一份命局去深入分析完全不相关的问题（十神在不同问题中作用不同）
- 在事业 Session 中突然按配偶星大篇幅分析感情
- 跨话题混合行动建议

发现完全偏离 → 必须：
1. 拒绝深入新话题（response 中说明，不要偷偷展开感情/健康全文分析）
2. should_show_new_session_button: true
3. 询问用户是否继续原话题`;

const TIAN_GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const DI_ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

const GAN_ELEMENTS: Record<string, string> = {
  甲: "阳木",
  乙: "阴木",
  丙: "阳火",
  丁: "阴火",
  戊: "阳土",
  己: "阴土",
  庚: "阳金",
  辛: "阴金",
  壬: "阳水",
  癸: "阴水",
};

/** 立春前仍算上一农历流年（简化：2 月 4 日前）。 */
export function liChunYearForDate(date: Date): number {
  const gregorianYear = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month < 2 || (month === 2 && day < 4)) return gregorianYear - 1;
  return gregorianYear;
}

function ganZhiForLiChunYear(liChunYear: number): { gan_zhi: string; element: string } {
  const offset = (liChunYear - 1984 + 6000) % 60;
  const gan = TIAN_GAN[offset % 10];
  const zhi = DI_ZHI[offset % 12];
  return { gan_zhi: `${gan}${zhi}`, element: GAN_ELEMENTS[gan] ?? "" };
}

export type CurrentYearGanZhi = {
  /** 公历年份（日历显示） */
  year: number;
  month: number;
  day: number;
  /** 用于流年干支的农历年（立春换年） */
  li_chun_year: number;
  gan_zhi: string;
  element: string;
  detailed: string;
};

/**
 * 今天对应的流年干支（60 甲子循环；1984 = 甲子）。
 */
export function calculateCurrentYearGanZhi(now = new Date()): CurrentYearGanZhi {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const liChunYear = liChunYearForDate(now);
  const { gan_zhi, element } = ganZhiForLiChunYear(liChunYear);

  return {
    year,
    month,
    day,
    li_chun_year: liChunYear,
    gan_zhi,
    element,
    detailed: `公历 ${year} 年 ${month} 月 ${day} 日，农历流年 ${gan_zhi}（${element}）`,
  };
}

function formatIsoLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getEnglishDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** 每个 phase system prompt 注入：真实今天 + 当前流年干支 */
export function buildCurrentDateContext(now = new Date(), locale = "en"): string {
  const yearInfo = calculateCurrentYearGanZhi(now);
  const isoToday = formatIsoLocalDate(now);
  const englishDate = getEnglishDate(now);
  const nextLiChunYear = yearInfo.li_chun_year + 1;
  const nextGz = ganZhiForLiChunYear(nextLiChunYear);
  const zh = locale.startsWith("zh");

  return `# ⚠️ 当前真实日期（关键！不要用训练数据里的过时年份）

今天的实际日期：${isoToday}（${englishDate}）

当前流年：${yearInfo.gan_zhi}（${yearInfo.element}）
完整描述：${yearInfo.detailed}
下一流年（「明年」指这个）：${nextGz.gan_zhi}（${nextGz.element}，约 ${nextLiChunYear + 1} 年立春后起）

⚠️ 重要规则：
- 不要使用「2024 甲辰年」「2025 乙巳年」等过时表述
- 当前流年是【${yearInfo.gan_zhi}】；说「今年」必须指 ${yearInfo.gan_zhi}
- 说「明年」默认指【${nextGz.gan_zhi}】，并自行换算公历（约 ${yearInfo.year + 1} 年起）
- 推算未来时间从【今天 ${isoToday}】起算，不是从 2024 或 2025 起算

时间表述示例：
✓ 「今年 ${yearInfo.gan_zhi}，……」
✓ 「明年 ${nextGz.gan_zhi}（约公历 ${yearInfo.year + 1}–${yearInfo.year + 2} 年），……」
✓ 「从今天（${isoToday}）起未来 3 个月、半年、一年……」（自行按真实日历推算，勿写死 2024/2025）
✗ 「2024 年……」「2025 乙巳年……」（过时！）

${zh ? "回复用户时请用中文日期语境；干支术语可保留。" : "Use the user's language for dates; keep Gan-Zhi terms when relevant."}`;
}

export function detectLanguage(text: string, locale: string): string {
  if (!text || text === "__OPENING__") {
    return locale.startsWith("zh") ? "Chinese (Simplified)" : "English";
  }
  if (text.startsWith("[SYSTEM:")) return "System signal";
  if (/[\u4e00-\u9fa5]/.test(text)) return "Chinese (Simplified)";
  if (/[áéíóúñ¿¡]/i.test(text)) return "Spanish";
  if (/[àâäéèêëîïôöùûüÿç]/i.test(text)) return "French";
  if (/[äöüß]/i.test(text)) return "German";
  return "English";
}

export function buildLanguageGuidance(locale: string, userMessage: string): string {
  const detected = detectLanguage(userMessage, locale);
  return `# 输出语言

用户当前使用语言: ${detected}
Session locale: ${locale}

请用用户使用的语言回复。
如果用户中英文混用，以最近一句的主要语言为准。`;
}

/** 非中文用户：行动建议本地化（北美/全球可执行） */
export function buildNorthAmericaAdaptation(locale: string): string {
  if (locale.startsWith("zh")) return "";
  return `# 文化适配（欧美/全球用户）

- 行动要可在美国/当地立刻执行：具体时间、地点、可买到的物件
- 风水建议优先：办公桌/卧室/家门朝向、颜色与材质，避免必须回国才能做的仪式
- 职业/金钱建议用当地商业语境（融资、客户、合同、远程工作等）
- 尊重个人主义：不假设必须与父母同住或服从家族安排，除非用户已说明`;
}

export function buildProfileContextSection(
  profile: UserProfile | null,
  baseAnalysis: unknown,
): string {
  if (!profile) {
    return "# 用户的命盘信息\n\n(用户尚未提供命盘信息 — 不要编造八字结论，只问情境问题。)";
  }

  const bazi = profile.bazi;
  const y = splitPillar(bazi.yearPillar);
  const m = splitPillar(bazi.monthPillar);
  const d = splitPillar(bazi.dayPillar);
  const h = splitPillar(bazi.hourPillar);
  const birth = profile.birth;

  const analysisBlock = formatBaseAnalysisForPrompt(baseAnalysis);

  return `# 用户的命盘信息（仅供你内部分析使用）

## 八字四柱
- 年柱: ${y.stem}${y.branch} (${bazi.yearPillar})
- 月柱: ${m.stem}${m.branch} (${bazi.monthPillar})
- 日柱: ${d.stem}${d.branch} (${bazi.dayPillar}) ← 日主
- 时柱: ${h.stem}${h.branch} (${bazi.hourPillar})

## 出生信息
${birth.year}-${String(birth.month).padStart(2, "0")}-${String(birth.day).padStart(2, "0")} · ${birth.gender === "M" ? "男" : "女"} · ${birth.timezone}

## 日主与五行线索
日主: ${profile.diagnosis.dayMaster}
有利元素方向: ${profile.diagnosis.favorableElements.join(", ") || "—"}

${analysisBlock}

---

⚠️ 使用说明:
- 【性格结构数据】含精确四柱/用神/大运等术语 JSON，是计算与交叉验证的首要依据
- 【性格画像分析】是用户向白榜，可引用其洞察，但精确干支/大运以 structured 为准
- 不要在回复里粘贴 JSON 或命盘表格；把结论融入自然对话
- 用户困境沉重时，允许写得更充分（见各阶段字数要求），不要为短而短
- 行动建议必须基于这个命主结构`;
}

export function stitchPromptSections(...parts: string[]): string {
  const body = parts.filter((p) => p.trim().length > 0).join("\n\n");
  if (!body.trim()) return POJULIFE_LANGUAGE_RULES.trim();
  if (body.includes("重要语言规则")) return body;
  return `${body}\n\n${POJULIFE_LANGUAGE_RULES.trim()}`;
}
