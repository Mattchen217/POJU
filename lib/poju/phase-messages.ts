/** Phase 1–5 固定文案（与 Batch2 §6.2「Phase 1/2 不调用 LLM」一致）。es/de/fr 暂回退到 en。 */

type PhaseCopy = {
  phase1HasProfileTo3: string;
  phase1To2NeedForm: string;
  phase2NeedMore: string;
  phase2To3Complete: string;
  phase3To4: string;
  phase3Loop: string;
  phase4ActionIntro: string;
  phase4ActionFooter: string;
  phase5Track: string;
  skipToGeneric: string;
  formTitle: string;
  formSubtitle: string;
  fieldDisplayName: string;
  fieldBirthDate: string;
  fieldBirthTime: string;
  fieldUnknownTime: string;
  fieldGender: string;
  fieldCity: string;
  submitSaveProfile: string;
  skipGeneric: string;
  saving: string;
};

const en: PhaseCopy = {
  phase1HasProfileTo3:
    "Profile found. We can go straight into core analysis. Tell me the knot you want to untangle.",
  phase1To2NeedForm:
    "Before we go deeper, use the form below once: display name, birth date & time, gender, and birth city. This stays on your device and powers personalized analysis across POJU, Glyph, and Syncro.",
  phase2NeedMore:
    "A few fields are still missing in the form below (name, birth date & time, city). Fill them or choose “Continue with general guidance”.",
  phase2To3Complete:
    "Thanks — profile is saved. Now describe the decision pressure in one concrete paragraph.",
  phase3To4: "We have enough context. I will now generate 1–3 concrete actions with checkpoints.",
  phase3Loop:
    "I hear the loop. Push one layer deeper: what are you afraid will happen if you choose A vs B?",
  phase4ActionIntro: "Action plan drafted:",
  phase4ActionFooter: "Start with Action 1 today and report outcome.",
  phase5Track: "Tracking noted. I will revise your next action based on outcome. Let us continue.",
  skipToGeneric:
    "Understood. We will stay with general guidance (no birth-based engine). Describe your situation in one concrete paragraph.",
  formTitle: "Birth profile (one-time)",
  formSubtitle: "Fills the structured fields required for Phase 2. Saved encrypted on this device; also updates this POJU session.",
  fieldDisplayName: "How should we address you",
  fieldBirthDate: "Birth date (local)",
  fieldBirthTime: "Birth time (24h)",
  fieldUnknownTime: "Birth time unknown (use 12:00)",
  fieldGender: "Gender",
  fieldCity: "Birth city / region",
  submitSaveProfile: "Save profile & continue",
  skipGeneric: "Continue with general guidance",
  saving: "Saving…",
};

const zh: PhaseCopy = {
  phase1HasProfileTo3: "已找到档案，可直接进入核心分析。请用一段话说明你真正想解开的心结。",
  phase1To2NeedForm:
    "在继续之前，请先在下方表单填写：称呼、出生日期与时间、性别与出生城市。数据主要保存在本机，用于 POJU / Glyph / Syncro 的个性化推算。",
  phase2NeedMore:
    "下方表单仍有缺项（称呼、出生日期与时间、城市）。请补全，或选择「先用通用分析」。",
  phase2To3Complete: "收到，档案已保存。请用一段话具体描述你面临的选择压力。",
  phase3To4: "上下文已足够。接下来我会生成 1–3 条可执行行动并附检查点。",
  phase3Loop: "我听到你在绕圈。再往下挖一层：若选 A 与选 B，你分别最怕发生什么？",
  phase4ActionIntro: "行动草案：",
  phase4ActionFooter: "请从第 1 条行动开始，在今天内推进并回报结果。",
  phase5Track: "已记录。我会根据你的结果调整下一步行动，我们继续。",
  skipToGeneric: "好的。我们将使用通用分析（不使用基于出生信息的引擎）。请用一段话具体描述你的处境。",
  formTitle: "出生资料（一次性）",
  formSubtitle: "填写 Phase 2 所需结构化字段。数据加密保存在本机，并写入当前 POJU 会话。",
  fieldDisplayName: "如何称呼你",
  fieldBirthDate: "出生日期（公历）",
  fieldBirthTime: "出生时间（24 小时制）",
  fieldUnknownTime: "时辰不详（暂用 12:00）",
  fieldGender: "性别",
  fieldCity: "出生城市 / 地区",
  submitSaveProfile: "保存档案并继续",
  skipGeneric: "先用通用分析",
  saving: "保存中…",
};

const byLocale: Record<string, PhaseCopy> = { en, zh };

export function getPojuPhaseCopy(locale: string): PhaseCopy {
  const key = locale === "zh" ? "zh" : "en";
  return byLocale[key] ?? en;
}
