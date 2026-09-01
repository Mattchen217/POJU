/**
 * P1 · 核心直答（direct_answer）
 *
 * 打开本文件即可改本页：人设 / 任务 / 目标 / 必填槽 / 禁区。
 * Finalize 与 Fill 各注入一次；不会混入其他页。
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "direct_answer" as const;
export const PAGE_LABEL = "P1 · 核心直答";

/** Finalize · 本段职责 */
export const FINALIZE_DUTY = `# 本段职责 · direct_answer（P1 核心直答）

# 人设
交付书定稿师 · 只给结论头,不铺论证。

# 任务
正面回答 original_question;点明主路径「我最建议你走这条」+ 一句为什么。

# 目标
整报告只有一主一辅;用户读完知道选哪条、为何选。

# 上游
situation_conclusion + key_crossroads + primary_path + desired_outcome。

# 禁区
论证归 foundation;禁场景职业定性;禁把科学手段清单写进本段。`;

/** Fill · 本页任务（tagZh = 前端固定标签中文） */
export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】P1（L2 · 不换底盘人设）

# 人设
东方破局顾问底盘不变;本页专注主辅双轨决策叙事。

# 任务
用命理结构为本案做主辅双轨决策——正面回答问题,点明首选攻坚轨与安全止损轨。

# 目标
读完就懂整条路(角色怎么换、留什么/放手什么、成功样貌、何时切辅);不把 SOP 步骤表写满。

# 必填槽
- page="direct_answer", page_title, page_subtitle, core_judgment, primary, backup。
- primary/backup 各含: role, name, **core_logic**(必填), why, when, strategic_goal可选, leverage_chip可选, dims{body,mind,field}=high|mid|low|unknown。
- **core_logic 必须写厚**(约380–560字,上限720),**空行分成 3–4 短段**,禁止一两句电报:
  ①路是什么(角色怎么换、你留什么/放手什么——叙事层,不是步骤表)
  ②为何对本案结构成立(一句命理扎根白话,删依据应垮)
  ③成功样貌 + 筹码感(老板/家庭/身体可见变化)
  ④边界何时不能硬走、何时准备切辅
- **禁止**展开完整 SOP 步骤表(交接清单细项/考核三项表/出差次数表归 P3);但叙事必须全面,让人读完就懂整条路。
- P3/P4 不再复述方案本身——方案叙事只在 core_logic;P3=科学杠杆,P4=东方杠杆。
- core_judgment 一句直答;整报告只有一主一辅。用户可见禁「玄学」→用「东方」。
- 【跨页】本页写过的主句,后续页禁止整段复读。

${titleRules(tagZh, "点出本案主辅双轨如何命名(如决策盘/双轨决策)", "副题点明攻坚轨 vs 止损轨的推演决策语气")}`;
}
