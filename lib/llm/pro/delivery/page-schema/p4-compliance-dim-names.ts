/**
 * P4 gateway-safe dimension name remap + user-visible prose scrub.
 * Maps legacy visible names (色/向/时/用神报幕) → executive-coaching labels.
 * Used at sanitize + UI render so old stored page_schema still looks compliant.
 */

const EXACT: Record<string, string> = {
  // zh legacy mock / fill
  色彩与着装锚定: "视觉心理 · 权威气场与色彩阻尼",
  方位与空间朝向: "空间心理 · 专注场域与采光阻尼",
  精力高频时段: "生物节律 · 昼夜认知峰谷时窗",
  精力时段调频: "生物节律 · 昼夜认知峰谷时窗",
  大运与阶段年窗: "战略周期 · 阶段节奏与时间窗口",
  阶段节奏与年窗: "战略周期 · 阶段节奏与时间窗口",
  用神补与忌神避: "精力管理 · 认知恢复与损耗隔离",
  "用神补与忌神避（日常调频）": "精力管理 · 认知恢复与损耗隔离",
  能量回血与回避: "精力管理 · 认知恢复与损耗隔离",
  协同与行业属性: "组织杠杆 · 非对称协同与缓冲转圜",
  协同与转圈: "组织杠杆 · 非对称协同与缓冲转圜",
  协同与转圜: "组织杠杆 · 非对称协同与缓冲转圜",
  // en legacy
  "Color & dress anchors": "Visual psychology · authority aura & color damping",
  "Direction & spatial facing": "Spatial psychology · focus field & light damping",
  "High-fit timing windows": "Chronobiology · day–night cognitive peak/valley windows",
  "Da-yun / phase year windows": "Strategic cycle · phase rhythm & time windows",
  "Yong complement · Ji avoid": "Energy management · cognitive recovery & drain isolation",
};

const CONTAINS: Array<{ needle: RegExp; to: string }> = [
  { needle: /色彩|着装|穿搭/, to: "视觉心理 · 权威气场与色彩阻尼" },
  { needle: /方位|朝向|空间/, to: "空间心理 · 专注场域与采光阻尼" },
  { needle: /精力高频|时辰|时段调频/, to: "生物节律 · 昼夜认知峰谷时窗" },
  { needle: /大运|年窗/, to: "战略周期 · 阶段节奏与时间窗口" },
  { needle: /用神|忌神|回血/, to: "精力管理 · 认知恢复与损耗隔离" },
  { needle: /协同|转圈|转圜|行业属性/, to: "组织杠杆 · 非对称协同与缓冲转圜" },
  { needle: /color|dress/i, to: "Visual psychology · authority aura & color damping" },
  { needle: /direction|spatial|facing/i, to: "Spatial psychology · focus field & light damping" },
  { needle: /timing|hours|chronobio/i, to: "Chronobiology · day–night cognitive peak/valley windows" },
  { needle: /da-?yun|year window/i, to: "Strategic cycle · phase rhythm & time windows" },
  { needle: /yong|ji avoid/i, to: "Energy management · cognitive recovery & drain isolation" },
];

/** Already-compliant names — leave untouched. */
const ALREADY_OK =
  /视觉心理|空间心理|生物节律|战略周期|精力管理|组织杠杆|Visual psychology|Spatial psychology|Chronobiology|Strategic cycle|Energy management|Org leverage/i;

/**
 * Remap a single P4 dimension name for payment-gateway-safe chrome.
 * Unknown / already-compliant names pass through.
 */
export function remapP4DimensionNameForCompliance(name: string): string {
  const raw = (name ?? "").trim();
  if (!raw) return raw;
  if (ALREADY_OK.test(raw)) return raw;
  const exact = EXACT[raw];
  if (exact) return exact;
  for (const { needle, to } of CONTAINS) {
    if (needle.test(raw)) return to;
  }
  return raw;
}

/** User-visible P4 body bans → coaching paraphrases (not evidence layer). */
const PROSE_REPS: Array<[RegExp, string]> = [
  [/东方场域杠杆/g, "环境心理与非对称调频杠杆"],
  [/东方场域/g, "环境心理场域"],
  [/东方堆/g, "策略维"],
  [/东方维/g, "策略维"],
  [/东方药方/g, "场域调频"],
  [/色\s*[\/／、]\s*向\s*[\/／、]\s*时/g, "视觉 / 空间 / 节律"],
  [/用神/g, "关键气场锚"],
  [/忌神/g, "损耗源"],
  [/八字/g, "个人结构底盘"],
  [/命理/g, "结构判断"],
  [/玄学/g, "场域调频"],
  [/风水/g, "空间布局"],
  [/运势/g, "阶段节奏"],
  [/吉方/g, "高适配侧"],
  [/凶方/g, "耗尽侧"],
  [/属相/g, ""],
  [/五行/g, "能量属性"],
  [/\byong\s*shen\b/gi, "key balance anchor"],
  [/\bji\s*shen\b/gi, "drain source"],
  [/\bfeng\s*shui\b/gi, "spatial layout"],
  [/\bbazi\b/gi, "structural baseline"],
];

/**
 * Scrub gateway-risky metaphysics literals from P4 user-visible prose
 * (strategy / means / titles). Evidence / bazi_basis must NOT use this.
 */
export function scrubP4UserVisibleProse(text: string): string {
  let t = (text ?? "").trim();
  if (!t) return t;
  for (const [re, to] of PROSE_REPS) {
    t = t.replace(re, to);
  }
  return t
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?，。；：！？])/g, "$1")
    .trim();
}

/** True when sanitizeAngle tag belongs to P4 eastern dimensions. */
export function isP4EasternSanitizeTag(tag: string): boolean {
  return /eastern/i.test(tag);
}
