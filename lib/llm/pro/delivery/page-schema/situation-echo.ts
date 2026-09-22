/**
 * Client-safe echo checks. No server imports — sanitize runs in the
 * delivery preview bundle, which cannot pull node:crypto.
 */

/** True when evidence echoes a long stretch of the interview cite (any topic). */
export function citeEchoedInEvidence(
  evidence: string,
  calcCite: string | null | undefined,
): boolean {
  const cite = (calcCite ?? "").trim();
  if (cite.length < 14) return false;
  const body = cite.replace(/^[^：:]{1,48}[：:]\s*/, "").trim();
  const source = body.length >= 12 ? body : cite;
  const norm = (s: string) => s.replace(/[，。、“”「」'"\s／/、]/g, "");
  const evN = norm(evidence);
  const srcN = norm(source);
  if (srcN.length < 12 || evN.length < 12) return false;
  for (let i = 0; i <= srcN.length - 12; i++) {
    const win = srcN.slice(i, i + 12);
    if (/^[0-9A-Za-z]+$/.test(win)) continue;
    if (evN.includes(win)) return true;
  }
  return false;
}

/** True when prose repeats a long stretch of collected situation material. */
export function proseEchoesSituation(
  prose: string,
  material: string | null | undefined,
): boolean {
  const blob = (material ?? "").trim();
  if (!blob || !prose.trim()) return false;
  const lines = blob
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length >= 14 &&
        !s.startsWith("【") &&
        !s.startsWith("禁止") &&
        !s.startsWith("这些是"),
    );
  if (lines.some((line) => citeEchoedInEvidence(prose, line))) return true;
  return citeEchoedInEvidence(prose, blob);
}

function normSituation(s: string): string {
  return s.replace(/[，。、“”「」'"\s／/、]/g, "");
}

/**
 * Collected agenda / Q&A echo (≥4 han segments from material).
 * Category gate for P2 fill — not a chart-specific phrase list.
 */
export function proseEchoesCollectedAgenda(
  prose: string,
  material: string | null | undefined,
): boolean {
  const blob = (material ?? "").trim();
  if (!blob || !prose.trim()) return false;
  const evN = normSituation(prose);
  const segments = new Set<string>();
  for (const raw of blob.split(/[\n，,。；;]+/)) {
    const seg = normSituation(raw.trim());
    if (seg.length < 4) continue;
    if (!/[\u4e00-\u9fff]/.test(seg)) continue;
    segments.add(seg);
  }
  const sorted = [...segments].sort((a, b) => b.length - a.length);
  for (const seg of sorted) {
    if (evN.includes(seg)) return true;
  }
  const srcN = normSituation(blob).slice(0, 2400);
  for (let len = 12; len >= 4; len--) {
    for (let i = 0; i <= srcN.length - len; i++) {
      const win = srcN.slice(i, i + len);
      if (!/^[\u4e00-\u9fff]+$/.test(win)) continue;
      if (evN.includes(win)) return true;
    }
  }
  return false;
}

/**
 * Soft pressure / feeling frames — same category as write SOFT_FRAME.
 * Fill body must not use these as a substitute for translating 批断.
 */
export const FILL_SOFT_FRAME_RE =
  /更易感到|更易落入|更易处于|更易被当成|绑定与投入|配合位|让步位|该结构|就你侧|就本案表象|压力落在你侧|结构感受|结构上你更易|结构上更易|底层能量配置|能量结构中|能量配置中|能量状态|内部能量|代表稳定和承载|代表输出和表达|代表思考|代表创造|代表自我保护/;

export function hasFillSoftFrame(prose: string): boolean {
  return FILL_SOFT_FRAME_RE.test(prose.trim());
}

/** User-visible body that prescribes what to do instead of translating judgment. */
export function isFillActionPrescription(prose: string): boolean {
  const t = prose.trim();
  if (!t) return false;
  if (/(?:因此|所以)[^。]{0,48}(?:你需要|你应该|务必|先以|不要急于|搞清楚|不急于)/.test(t)) {
    return true;
  }
  if (/(?:建议|应当)[^。]{0,24}(?:兼职|全职|股权|话术|开口谈)/.test(t)) {
    return true;
  }
  if (/你需要在[^。]{0,24}找到平衡/.test(t)) return true;
  if (/这解释了为何你/.test(t)) return true;
  return false;
}

/**
 * P3 plain-judgment：处境决策词类别（非本盘原句黑名单）。
 * 批断白话可写加压/泄压/通关；不可写兼职谈判剧本词。
 * 不用 4 字滑窗对照整段 Lab core——那会误杀合格机制译。
 */
export const FILL_DECISION_SITUATION_RE =
  /兼职|全职|股权|开口谈|话语权|画饼|提案大纲|合作提案|律师(?:条款|模板|协议)|模拟谈判|股权兑现|稳定收入|阶段性试水|试水看看/;

export function hasFillDecisionSituationPaste(prose: string): boolean {
  return FILL_DECISION_SITUATION_RE.test(prose.trim());
}

/**
 * Empty industrial / wellness shells that replace structure-chain translation.
 * Category gate for P3 plain-judgment — not chart-specific sentences.
 */
export const FILL_EMPTY_SHELL_RE =
  /冷却液|冷却机制|冷却系统|冷却循环|系统过热|排气阀|机器在高温|炉膛|往火里添柴|优质金属被高温|自我强化的冷却/;

export const FILL_WELLNESS_SCRIPT_RE =
  /静坐|深呼吸|冥想|固定的睡眠时间|定期的独处|学习、考证|阅读、冥想/;

export function hasFillEmptyShell(prose: string): boolean {
  return FILL_EMPTY_SHELL_RE.test(prose.trim());
}

export function hasFillWellnessScript(prose: string): boolean {
  return FILL_WELLNESS_SCRIPT_RE.test(prose.trim());
}
