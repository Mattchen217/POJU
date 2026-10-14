/**
 * #11 Invented user-absent numbers — prompt duty + category gate (+ light scrub).
 *
 * Ban concrete quantities in delivery *visible body* that the user / collecting
 * feed did not provide: buffer months, deadlines, hours quotas, $, %, ages,
 * date-as-fact claims, etc. Allow amounts that appear in reality_blob
 * (collecting / expectation / calc slice). Chart true-words stay in
 * chart_anchors (excluded from visible blobs) — not a blunt "no digits" ban.
 *
 * P3/P4/P5 already hard-gate schedule/contract/X% via gate-body-category;
 * this module elevates the documented P1 `p1b_invented_number` duty and
 * covers money / age / percent-claim categories across pages.
 */

export const INVENTED_USER_NUMBER_RULE_ID =
  "gate_body_invented_user_absent_number" as const;

/** P1 checklist elevation alias (same detector). */
export const P1_INVENTED_NUMBER_RULE_ID =
  "gate_p1_body_invented_number" as const;

export const INVENTED_USER_NUMBER_DUTY_LINE =
  `  · **发明数字整类（硬 · #11）**：缓冲月数/期限天数/工时配额/$/%/年龄/把日期当事实等须来自收集或喂料；未给则写可观察信号，禁自造具体量`;

export type InventedNumberKind =
  | "schedule"
  | "contract"
  | "percent_placeholder"
  | "money"
  | "age"
  | "percent_claim";

export type InventedNumberHit = {
  kind: InventedNumberKind;
  hit: string;
};

const CN_DUR_NUM = "[一二两三四五六七八九十百\\d]+";
const CN_YEAR_NUM = "[一二两三四五六七八九十百\\d]+";

/** Schedule / duration invent (aligned with gate-body-category INVENTED_SCHEDULE_RE). */
const INVENTED_SCHEDULE_RE = new RegExp(
  [
    `每周不超过\\s*\\d+`,
    `每周.{0,6}\\d+\\s*小时`,
    `前\\s*${CN_DUR_NUM}\\s*个?月`,
    `至少\\s*\\d+\\s*小时`,
    `冷静期`,
    `\\d+\\s*小时考虑`,
    `下个月中旬`,
    `${CN_DUR_NUM}\\s*天内`,
    `${CN_DUR_NUM}\\s*周内`,
    `两周内`,
    `三天内`,
    `连续\\s*${CN_DUR_NUM}\\s*个?月`,
    `连续\\s*${CN_DUR_NUM}\\s*天`,
    `明天内`,
    `明天开始`,
    `每半个?月`,
    `每\\s*${CN_DUR_NUM}\\s*周`,
    `每\\s*${CN_DUR_NUM}\\s*天`,
    `列出\\s*${CN_DUR_NUM}\\s*位`,
    `(留出|给自己|设下?).{0,16}${CN_DUR_NUM}\\s*个?月`,
    `${CN_DUR_NUM}\\s*个?月的?(观察|缓冲|过渡|冷静)`,
    `${CN_DUR_NUM}\\s*个?月.{0,8}(观察|缓冲|过渡)`,
    `观察期.{0,12}${CN_DUR_NUM}\\s*个?月`,
    // EN schedule invent
    `within\\s+\\d+\\s*(?:days?|weeks?|months?)`,
    `\\d+\\s*hours?\\s*(?:per|/)?\\s*weeks?`,
    `at\\s+least\\s+\\d+\\s*hours?`,
    `\\d+-day\\s+(?:cooling|cool-off|buffer|trial)`,
    `\\d+\\s*months?\\s+(?:buffer|observation|trial|runway|cooling)`,
  ].join("|"),
  "i",
);

const INVENTED_CONTRACT_TERM_RE = new RegExp(
  `${CN_YEAR_NUM}\\s*年成熟|成熟期.{0,12}${CN_YEAR_NUM}\\s*年|${CN_YEAR_NUM}\\s*年\\s*cliff|一年\\s*cliff|四年成熟|\\bcliff\\b|行权期.{0,8}${CN_YEAR_NUM}\\s*年|vesting\\s*\\d+|\\d+-year\\s+vest(ing)?`,
  "i",
);

const INVENTED_PERCENT_PLACEHOLDER_RE = /\bX\s*%|\bY\s*%|百分之\s*[XY]/i;

/** Money amounts presented as facts (category · not bare currency symbols alone). */
const INVENTED_MONEY_RE =
  /\$\s*[\d,]+(?:\.\d+)?\s*[kKmMbB]?|\b(?:USD|usd)\s*[\d,]+|\b[\d,]+\s*(?:USD|usd)\b|\d+\s*万(?:元|美元|人民币)?|\d+\s*千(?:元|块)?|年薪\s*\d+|月入\s*\d+|月薪\s*\d+|薪水\s*\d+|工资\s*\d+/;

/** Age presented as fact. */
const INVENTED_AGE_RE = /\d+\s*岁|年龄\s*[：:.]?\s*\d+|\bage\s*[：:.]?\s*\d+\b/i;

/**
 * Concrete percent claims (not X%/Y% placeholders).
 * Structural page ratios like "1/2" are not matched.
 */
const INVENTED_PERCENT_CLAIM_RE =
  /\d{1,3}\s*%|百分之\s*[一二两三四五六七八九十百零\d]+/;

function durationAllowedByReality(hit: string, reality: string): boolean {
  if (!reality.trim()) return false;
  // Exact / compact hit already in collecting feed
  const compactHit = hit.replace(/\s+/g, "");
  const compactReality = reality.replace(/\s+/g, "");
  if (compactHit.length >= 2 && compactReality.includes(compactHit)) return true;
  // 每周不超过N（pattern may omit trailing 小时）
  const weekCap = hit.match(/每周不超过\s*(\d+)/);
  if (
    weekCap?.[1] &&
    new RegExp("每周不超过\\s*" + weekCap[1]).test(reality)
  ) {
    return true;
  }
  if (/半年|六个月/.test(hit) && /半年|六个月/.test(reality)) return true;
  if (/明天/.test(hit)) return /明天/.test(reality);
  if (/每半个?月/.test(hit)) return /每半个?月|半个月/.test(reality);
  const m = hit.match(new RegExp(`(${CN_DUR_NUM})\\s*(个?月|周|天|小时|位)`));
  if (m?.[1] && m[2]) {
    if (new RegExp(`${m[1]}\\s*${m[2]}`).test(reality)) return true;
    if (/月/.test(m[2]) && /^(六|6)$/.test(m[1]) && /半年/.test(reality)) {
      return true;
    }
  }
  if (/\d+\s*小时/.test(hit) && /\d+\s*小时/.test(reality)) return true;
  if (
    /试水/.test(hit) &&
    /试水.{0,8}\d+\s*个?月|\d+\s*个?月.{0,8}试水/.test(reality)
  ) {
    return true;
  }
  // EN
  const en = hit.match(/(\d+)\s*(days?|weeks?|months?|hours?)/i);
  if (en?.[1] && en[2]) {
    const unit = en[2].replace(/s$/i, "");
    if (new RegExp(`${en[1]}\\s*${unit}`, "i").test(reality)) return true;
    if (
      /month/i.test(unit) &&
      en[1] === "6" &&
      /半年|六个月|6\s*months?/i.test(reality)
    ) {
      return true;
    }
  }
  return false;
}

function contractTermAllowedByReality(hit: string, reality: string): boolean {
  if (!reality.trim()) return false;
  const years = hit.match(new RegExp(`(${CN_YEAR_NUM})\\s*年`));
  if (years?.[1] && new RegExp(`${years[1]}\\s*年`).test(reality)) return true;
  if (/cliff/i.test(hit) && /cliff/i.test(reality)) return true;
  if (/成熟/.test(hit) && /成熟/.test(reality) && years?.[1]) {
    return new RegExp(`${years[1]}\\s*年`).test(reality);
  }
  const enY = hit.match(/(\d+)\s*-?\s*year/i);
  if (enY?.[1] && new RegExp(`${enY[1]}\\s*-?\\s*year`, "i").test(reality)) {
    return true;
  }
  return false;
}

/** True when the concrete token (digits / CN numeral + unit) appears in reality. */
function tokenAllowedByReality(hit: string, reality: string): boolean {
  if (!reality.trim()) return false;
  const compactHit = hit.replace(/\s+/g, "");
  const compactReality = reality.replace(/\s+/g, "");
  if (compactHit.length >= 2 && compactReality.includes(compactHit)) return true;
  for (const m of hit.matchAll(
    /(\d+(?:\.\d+)?)\s*([%万千岁元块]|小时|个月|月|周|天|k|K|m|M)?/g,
  )) {
    const num = m[1]!;
    const unit = m[2] ?? "";
    if (unit && new RegExp(`${num}\\s*${unit}`).test(reality)) return true;
    if (!unit && reality.includes(num) && /[$￥%万]/.test(hit)) {
      if (/[$￥]|万|千|USD|%|百分之/.test(reality) && reality.includes(num)) {
        return true;
      }
    }
  }
  for (const m of hit.matchAll(
    /([一二两三四五六七八九十百]+)\s*(个?月|周|天|岁|年)/g,
  )) {
    if (new RegExp(`${m[1]}\\s*${m[2]}`).test(reality)) return true;
  }
  return false;
}

function firstMatch(re: RegExp, text: string): string | null {
  const m = text.match(re);
  return m?.[0] ?? null;
}

/**
 * Find first invented concrete quantity not grounded in reality_blob.
 * Returns null when clean or when every hit is allowlisted by collecting facts.
 */
export function findInventedUserAbsentNumber(
  visible: string,
  reality: string,
): InventedNumberHit | null {
  const text = String(visible ?? "");
  const real = String(reality ?? "");

  const scheduleHit = firstMatch(INVENTED_SCHEDULE_RE, text);
  if (scheduleHit && !durationAllowedByReality(scheduleHit, real)) {
    return { kind: "schedule", hit: scheduleHit.slice(0, 48) };
  }

  const contractHit = firstMatch(INVENTED_CONTRACT_TERM_RE, text);
  if (contractHit && !contractTermAllowedByReality(contractHit, real)) {
    return { kind: "contract", hit: contractHit.slice(0, 48) };
  }

  const pctPh = firstMatch(INVENTED_PERCENT_PLACEHOLDER_RE, text);
  if (pctPh) {
    return { kind: "percent_placeholder", hit: pctPh.slice(0, 24) };
  }

  const moneyHit = firstMatch(INVENTED_MONEY_RE, text);
  if (moneyHit && !tokenAllowedByReality(moneyHit, real)) {
    return { kind: "money", hit: moneyHit.slice(0, 48) };
  }

  const ageHit = firstMatch(INVENTED_AGE_RE, text);
  if (ageHit && !tokenAllowedByReality(ageHit, real)) {
    return { kind: "age", hit: ageHit.slice(0, 32) };
  }

  const pctHit = firstMatch(INVENTED_PERCENT_CLAIM_RE, text);
  if (pctHit && !tokenAllowedByReality(pctHit, real)) {
    return { kind: "percent_claim", hit: pctHit.slice(0, 24) };
  }

  return null;
}

export function inventedUserNumberGateDetail(hit: InventedNumberHit): string {
  return (
    `可见层编造用户未提供的具体量（#11 · ${hit.kind}：「${hit.hit}」）。` +
    `缓冲月数/工时/$/%/年龄/期限等须来自收集或喂料；未给则改可观察信号或「按书面约定…」。` +
    `闸门不改稿；chart_anchors / 系统真算数字不在此禁（真词留锚点槽）。`
  );
}

/** Shared duty / polish ban block (#11). */
export function inventedUserNumberPromptBlock(
  locale: "zh" | "en" | "es" | "fr" = "zh",
): string {
  if (locale === "en") {
    return [
      `## Invented numbers ban (#11 · categories · still true after name-delete)`,
      `- **Ban** concrete quantities the collecting feed did not give: buffer months, deadlines, weekly hours quotas, dollar amounts, percents, ages, dates-as-facts.`,
      `- **Allow** amounts that appear in the collecting / reality / calc feed; system chart numbers belong in chart_anchors, not invented in prose.`,
      `- If unknown → observable signals or "per written agreement" — never invent a numeral to sound precise.`,
    ].join("\n");
  }
  if (locale === "es") {
    return [
      `## Prohibido inventar cifras (#11 · categorías)`,
      `- Prohibido cantidades concretas no dadas en la recogida: meses buffer, plazos, horas/semana, $, %, edades.`,
      `- Permitido solo lo que aparece en hechos recogidos / reality; cifras de carta → chart_anchors.`,
      `- Si no está → señales observables o «según lo acordado por escrito».`,
    ].join("\n");
  }
  if (locale === "fr") {
    return [
      `## Interdit d'inventer des chiffres (#11 · catégories)`,
      `- Interdit quantités concrètes absentes de la collecte: mois tampon, délais, heures/semaine, $, %, âges.`,
      `- Autorisé seulement ce qui figure dans les faits / reality; chiffres de thème → chart_anchors.`,
      `- Si inconnu → signaux observables ou «selon l'accord écrit».`,
    ].join("\n");
  }
  return [
    `## 发明数字禁区（#11 · 类别 · 换盘仍成立）`,
    `- **禁**用户/收集未提供的具体量：缓冲月数、期限天数、周工时配额、金额、$、%、年龄、把未给日期当事实。`,
    `- **许**收集/reality/真算喂料里已出现的量；系统盘面数字进 chart_anchors，禁止在可见正文里瞎编精确数字充专业。`,
    `- 未给 → 写可观察信号或「按书面约定…」——宁缺精确，勿发明。`,
  ].join("\n");
}

/**
 * Light scrub: X%/Y% placeholders → 按书面约定比例.
 * Does NOT strip grounded digits (gate handles those). Safe deterministic pass.
 */
export function scrubInventedPercentPlaceholders(text: string): {
  text: string;
  scrubbed: boolean;
} {
  const src = String(text ?? "");
  const next = src
    .replace(/\bX\s*%/gi, "按书面约定比例")
    .replace(/\bY\s*%/gi, "按书面约定比例")
    .replace(/百分之\s*[XY]/gi, "按书面约定比例");
  return { text: next, scrubbed: next !== src };
}

/** Scrub percent placeholders across string fields of a plain object (shallow+arrays). */
export function scrubInventedPercentPlaceholdersInTree<T>(value: T): {
  value: T;
  scrubbed: boolean;
} {
  let scrubbed = false;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = scrubInventedPercentPlaceholders(v);
      if (r.scrubbed) scrubbed = true;
      return r.text;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        // Never scrub chart_anchors — may hold closed-set tokens
        if (k === "chart_anchors") {
          out[k] = val;
          continue;
        }
        out[k] = walk(val);
      }
      return out;
    }
    return v;
  };
  return { value: walk(value) as T, scrubbed };
}
