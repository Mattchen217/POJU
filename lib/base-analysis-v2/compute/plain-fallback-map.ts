/**
 * 【】中性平替兜底 —— 最后一道清洗层（只兜底，不替代金字系统）。
 *
 * 用途：sanitizer / autoMark 处理不了的简称或漏网命理词 → 【中性名词】，
 * 保证不打回重算、不裸露违规词、句式仍通顺。
 *
 * ⚠️ 不替代 ⟦t:slug|⟧。已打标区域必须跳过。
 * ⚠️ 第1次真算只跑「合称」平替，避免把 bazi_basis 里合法全称（七杀/伤官）误平替掉。
 */

/** 十神合称 / 合称漏网 —— sanitizer 上下文还原之后仍可能残留。 */
export const PLAIN_FALLBACK_COMPOUNDS: Readonly<Record<string, string>> = {
  财官杀: "【外部责任与挑战】",
  官杀: "【外部挑战与压力】",
  食伤: "【表达与创造力】",
  比劫: "【同伴竞合力量】",
  印枭: "【内在支持与直觉】",
  枭印: "【深度直觉觉察】",
  财官: "【务实目标与责任】",
  杀印: "【压力下的内在转化】",
};

/**
 * 正文漏网单称 —— 仅用于第2次白话层（不应出现真词）。
 * 第1次 bazi_basis 禁止跑这张表。
 */
export const PLAIN_FALLBACK_BODY_SINGLES: Readonly<Record<string, string>> = {
  七杀: "【外部挑战与压力】",
  正官: "【秩序与责任】",
  伤官: "【突破性表达】",
  食神: "【从容表达力】",
  偏印: "【深度直觉觉察】",
  正印: "【内在滋养】",
  劫财: "【同伴竞合力量】",
  比肩: "【并肩同行】",
  偏财: "【机动资源】",
  正财: "【稳健资源】",
  日主: "【内在本色】",
  用神: "【关键补给】",
  喜神: "【有益能量】",
  忌神: "【干扰能量】",
  大运: "【人生阶段】",
  流年: "【当下外境】",
  流时: "【当下节奏】",
  五行: "【能量五行】",
  八字: "【能量结构】",
};

export type PlainFallbackOptions = {
  /** Include body-only singles (七杀/日主…). Default false — compute must omit. */
  includeSingles?: boolean;
};

function buildMap(opts?: PlainFallbackOptions): ReadonlyArray<[string, string]> {
  const merged: Record<string, string> = { ...PLAIN_FALLBACK_COMPOUNDS };
  if (opts?.includeSingles) {
    Object.assign(merged, PLAIN_FALLBACK_BODY_SINGLES);
  }
  return Object.entries(merged).sort((a, b) => b[0].length - a[0].length);
}

/** Replace bare fallback terms in one string; skip inside ⟦t:…⟧ markers. */
export function applyPlainFallbackToText(
  text: string,
  opts?: PlainFallbackOptions,
): string {
  if (!text) return text;

  const markers: string[] = [];
  const protectedText = text.replace(/⟦t:[^⟧]*⟧/g, (m) => {
    const i = markers.length;
    markers.push(m);
    return `\u0000M${i}\u0000`;
  });

  let out = protectedText;
  for (const [from, to] of buildMap(opts)) {
    if (out.includes(from)) out = out.split(from).join(to);
  }

  return out.replace(/\u0000M(\d+)\u0000/g, (_, i: string) => markers[Number(i)] ?? "");
}

/** Deep-walk any JSON-like value and apply plain fallback to every string. */
export function applyPlainFallback<T>(obj: T, opts?: PlainFallbackOptions): T {
  if (typeof obj === "string") {
    return applyPlainFallbackToText(obj, opts) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => applyPlainFallback(item, opts)) as T;
  }
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      out[key] = applyPlainFallback(value, opts);
    }
    return out as T;
  }
  return obj;
}
