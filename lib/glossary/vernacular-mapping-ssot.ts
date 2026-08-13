/**
 * User-facing vernacular mapping SSOT (code twin).
 *
 * Canonical product doc:
 *   `.cursor/docs/全局用户可见表达契约-映射表-SSOT.md`
 *
 * Keep rows in sync with §2.3 of that doc. Prompts should import from here
 * (or via a thin builder) — do not fork a second soft map in phase files.
 */

export type VernacularFrame =
  | "stress_recovery"
  | "burnout_growth"
  | "decision_load"
  | "restore_input"
  | "cognition_style"
  | "social_load"
  | "capacity"
  | "life_phase"
  | "environment_cadence";

export type VernacularMappingRow = {
  id: string;
  engine_concept: string;
  user_facing_en: string;
  user_facing_zh: string;
  allowed_frame: VernacularFrame;
  /** Phrases / claim shapes that must not ride along with this mapping. */
  never: string;
  /** Typical engine anchors (illustrative). */
  trace: string;
};

/** Core v1 rows — extend only with doc + this file together. */
export const VERNACULAR_MAPPING_ROWS: readonly VernacularMappingRow[] = [
  {
    id: "fire_overheat",
    engine_concept: "火旺 / 燥热偏旺",
    user_facing_en: "sustained stress-drive; system running hot; over-activation",
    user_facing_zh: "持续高压驱动；系统偏热、过激活",
    allowed_frame: "stress_recovery",
    never: "诊断甲状腺/炎症；皮质醇化验证明",
    trace: "五行强弱 / 用忌",
  },
  {
    id: "water_thin_buffer",
    engine_concept: "水弱 / 缺水润",
    user_facing_en: "thin recovery buffer; hard to downshift",
    user_facing_zh: "恢复缓冲薄；难从工作态降档",
    allowed_frame: "stress_recovery",
    never: "肾虚医疗断言",
    trace: "喜水 / 弱水",
  },
  {
    id: "wood_scorched",
    engine_concept: "木被焚 / 生长空间被烤干",
    user_facing_en: "creative bandwidth scorched; growth room squeezed",
    user_facing_zh: "创造带宽被烤干；生长空间被挤",
    allowed_frame: "burnout_growth",
    never: "",
    trace: "木虚 / 火旺克木",
  },
  {
    id: "night_forced_wake",
    engine_concept: "丑时 / 夜半某时辰易醒",
    user_facing_en: "mid-sleep / early-morning forced wake under chronic load",
    user_facing_zh: "长期负荷下的半夜/凌晨被迫醒来",
    allowed_frame: "stress_recovery",
    never: "皮质醇化验证明；丑时/湿土等时辰专名",
    trace: "时辰宜忌仅内部；可见只谈时段现象",
  },
  {
    id: "authority_pressure",
    engine_concept: "官杀混杂 / 外界规范压力大",
    user_facing_en: "high external standard-pressure vs inner capacity",
    user_facing_zh: "外界规范/成就压力大、与内在容量冲突",
    allowed_frame: "decision_load",
    never: "必遭官非",
    trace: "官杀 / 压力维",
  },
  {
    id: "yin_restore",
    engine_concept: "印星滋养 / 需补印",
    user_facing_en: "need restorative input: learning, quiet structure, psychological safety",
    user_facing_zh: "需要滋养型输入：学习、安静结构、心理安全感",
    allowed_frame: "restore_input",
    never: "求神拜印",
    trace: "印星 / 用神",
  },
  {
    id: "output_rumination",
    engine_concept: "食伤旺 / 表达欲强易内耗",
    user_facing_en: "high express-output drive; rumination after friction",
    user_facing_zh: "表达/产出驱动强；受挫后易内耗打转",
    allowed_frame: "cognition_style",
    never: "",
    trace: "食伤",
  },
  {
    id: "peer_friction",
    engine_concept: "比劫争夺感",
    user_facing_en: "peer/resource alignment friction",
    user_facing_zh: "同伴/资源分配摩擦感",
    allowed_frame: "social_load",
    never: "",
    trace: "比劫",
  },
  {
    id: "thin_capacity",
    engine_concept: "身弱（内部）",
    user_facing_en: "capacity currently thinner than demand",
    user_facing_zh: "当前可动用容量偏紧、扛不住叠加需求",
    allowed_frame: "capacity",
    never: "命弱没救",
    trace: "身强弱",
  },
  {
    id: "pressure_band",
    engine_concept: "大运压力期（内部）",
    user_facing_en: "multi-year pressure band; several life domains stirred together",
    user_facing_zh: "一段较长时间的压力带；多领域同时被搅动",
    allowed_frame: "life_phase",
    never: "流年日期铁口",
    trace: "decade / 大运",
  },
  {
    id: "yong_restore_direction",
    engine_concept: "用神方向（内部）",
    user_facing_en: "what restores your system (rest / flow / structure / growth…)",
    user_facing_zh: "什么在给你的系统回血（静养/流动/结构/生长…）",
    allowed_frame: "restore_input",
    never: "开运方位宿命",
    trace: "yong_shen",
  },
  {
    id: "retune_cadence",
    engine_concept: "调频 / 补水木（内部）",
    user_facing_en: "rebuild recovery: sleep, green/watery environments, slower cadence",
    user_facing_zh: "重建恢复：睡眠、偏冷静的环境、放慢节奏",
    allowed_frame: "environment_cadence",
    never: "风水改命承诺",
    trace: "energy_retune_frame",
  },
] as const;

export function getVernacularMappingRow(id: string): VernacularMappingRow | undefined {
  return VERNACULAR_MAPPING_ROWS.find((r) => r.id === id);
}

export function selectVernacularMappingRows(ids: readonly string[]): VernacularMappingRow[] {
  const out: VernacularMappingRow[] = [];
  for (const id of ids) {
    const row = getVernacularMappingRow(id);
    if (row) out.push(row);
  }
  return out;
}

/** Compact prompt table for a subset of rows (locale-aware visible column). */
export function formatVernacularMappingForPrompt(
  ids: readonly string[],
  locale: string,
): string {
  const rows = selectVernacularMappingRows(ids);
  if (rows.length === 0) return "";
  const zh = !locale || locale.startsWith("zh");
  const lines = rows.map((r) => {
    const visible = zh ? r.user_facing_zh : r.user_facing_en;
    return `- ${r.engine_concept} → ${visible} (frame:${r.allowed_frame}; never:${r.never || "—"})`;
  });
  return ["【引擎概念 → 用户可见语 · 受控映射 · 禁止表外发明生理细节】", ...lines].join("\n");
}
