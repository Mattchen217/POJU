/**
 * P3 plain-judgment fill quality — categories only (iron 14–15).
 * Prompt is primary; this gate verifies the same scale across charts/topics.
 */

/** Near-duplicate angle prose (Han bigram Jaccard). */
export const FILL_ANGLE_COLLAPSE_MAX = 0.22;

/** Same vernacular lever on this many angles → collapse (with orphan check when evidence known). */
export const FILL_LEVER_REUSE_MIN = 3;

/**
 * Life-domain coach scripts that structure-judgment translation must not invent.
 * Domain categories — never chart-specific interview sentences.
 */
export const FILL_PARALLEL_LIFE_STORY_RE =
  /固定资产|流动资产|现金流|资产配置|资产变现|投融资|估值谈判|股权激励|产品路线图|甘特|OKR|KPI看板|情绪管理课|心理咨询|疗愈课程|商业计划书/;

/**
 * Lever stems vs structure-duty needles (from evidence).
 * Reusing a stem on cards whose批断 never asked for that class = orphan lever.
 */
const FILL_LEVER_STEMS: ReadonlyArray<{
  stem: string;
  dutyNeedles: readonly string[];
}> = [
  { stem: "输出", dutyNeedles: ["输出疏导"] },
  { stem: "分享", dutyNeedles: ["输出疏导"] },
  { stem: "教学", dutyNeedles: ["输出疏导"] },
  { stem: "复盘", dutyNeedles: ["输出疏导"] },
  { stem: "降温", dutyNeedles: ["降温通关", "干扰侧"] },
  { stem: "过热", dutyNeedles: ["降温通关", "干扰侧", "助燃"] },
  { stem: "缓冲", dutyNeedles: ["降温通关", "有益侧", "输出疏导"] },
  { stem: "冷静", dutyNeedles: ["降温通关", "有益侧"] },
];

/**
 * Closed structure classes extracted from evidence → vernacular translation duties.
 * Same classes on any chart; never injects interview prose.
 */
const STRUCTURE_DUTY_RULES: ReadonlyArray<{
  re: RegExp;
  duty: string;
}> = [
  { re: /半合|六合|三合/, duty: "合局/合力（加压或加固，跟批断方向）" },
  { re: /相害|相冲|相刑/, duty: "互耗或对冲（柱位/根基受撞击）" },
  { re: /大运/, duty: "人生阶段窗" },
  { re: /流年/, duty: "外境年窗" },
  { re: /流月/, duty: "近阶月窗" },
  { re: /用神|喜神/, duty: "有益侧调节" },
  { re: /忌神/, duty: "干扰侧加压" },
  { re: /制火|调候|通关/, duty: "降温通关动作" },
  { re: /泄秀|食神|伤官/, duty: "输出疏导" },
  { re: /生水|金生水|生助用/, duty: "补源再生调节力" },
  { re: /润木|水润|木生火|助燃/, duty: "助燃改润化/滋养转向" },
  { re: /身强|身弱/, duty: "承载力偏满或偏虚" },
];

export function structureTranslateDutiesFromEvidence(evidence: string): string[] {
  const raw = (evidence ?? "").trim();
  if (!raw) return [];
  const out: string[] = [];
  for (const rule of STRUCTURE_DUTY_RULES) {
    if (rule.re.test(raw) && !out.includes(rule.duty)) out.push(rule.duty);
  }
  return out;
}

export function formatStructureTranslateDutiesLine(evidence: string): string {
  const duties = structureTranslateDutiesFromEvidence(evidence);
  if (duties.length === 0) {
    return "本卡译出义务：只译该条批断里的结构链；禁止另起资产/投融资/项目管理/疗愈课故事。";
  }
  return `本卡译出义务（须在 strategy/means 里可分辨）：${duties.join(" · ")}。禁止另起资产/投融资/项目管理/疗愈课故事。`;
}

function hanBigrams(text: string): string[] {
  const n = text.replace(/[^\u4e00-\u9fff]/g, "");
  if (n.length < 2) return n ? [n] : [];
  const out: string[] = [];
  for (let i = 0; i < n.length - 1; i++) {
    out.push(n.slice(i, i + 2));
  }
  return out;
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export type FillAngleProse = {
  path: string;
  strategy: string;
  means: readonly string[];
};

export type FillEvidenceUnit = {
  path: string;
  evidence: string;
};

export function fillAngleProseBlob(a: FillAngleProse): string {
  return [a.strategy, ...a.means].join("\n");
}

/** Pairwise collapse of angle vernacular on one page. */
export function maxPairwiseFillAngleSimilarity(
  angles: readonly FillAngleProse[],
): { max: number; pair: string | null } {
  let max = 0;
  let pair: string | null = null;
  for (let i = 0; i < angles.length; i++) {
    for (let j = i + 1; j < angles.length; j++) {
      const ai = angles[i]!;
      const aj = angles[j]!;
      const jv = jaccard(
        hanBigrams(fillAngleProseBlob(ai)),
        hanBigrams(fillAngleProseBlob(aj)),
      );
      if (jv > max) {
        max = jv;
        pair = `${ai.path}↔${aj.path}`;
      }
    }
  }
  return { max, pair };
}

export function hasFillParallelLifeStory(prose: string): boolean {
  return FILL_PARALLEL_LIFE_STORY_RE.test(prose.trim());
}

function dutiesForPath(
  path: string,
  units: readonly FillEvidenceUnit[] | undefined,
): string[] {
  if (!units?.length) return [];
  const u = units.find((x) => x.path === path);
  return u ? structureTranslateDutiesFromEvidence(u.evidence) : [];
}

function dutyAllowsLever(duties: readonly string[], needles: readonly string[]): boolean {
  if (duties.length === 0) return true; // no evidence → don't orphan-punish; pairwise/collapse still apply
  return needles.some((n) => duties.some((d) => d.includes(n)));
}

export type FillPlainJudgmentScienceGate =
  | { ok: true; notes: string[] }
  | { ok: false; reason: string; notes: string[] };

/**
 * Category gates for P3 plain-judgment toolkit angles.
 * Optional units: evidence paths for lever-orphan checks (any chart).
 */
export function assessFillPlainJudgmentScienceAngles(
  angles: readonly FillAngleProse[],
  units?: readonly FillEvidenceUnit[],
): FillPlainJudgmentScienceGate {
  const notes: string[] = [];
  for (const a of angles) {
    const blob = fillAngleProseBlob(a);
    if (hasFillParallelLifeStory(blob)) {
      return {
        ok: false,
        reason: `fill_parallel_life_story:${a.path}`,
        notes: [...notes, `parallel_life:${a.path}`],
      };
    }
  }
  if (angles.length >= 2) {
    const { max, pair } = maxPairwiseFillAngleSimilarity(angles);
    notes.push(`fill_angle_sim_max:${max.toFixed(2)}${pair ? `@${pair}` : ""}`);
    if (max > FILL_ANGLE_COLLAPSE_MAX) {
      return {
        ok: false,
        reason: `fill_angle_collapse:${pair ?? "pair"}`,
        notes,
      };
    }
  }
  for (const { stem, dutyNeedles } of FILL_LEVER_STEMS) {
    const hits = angles.filter((a) => fillAngleProseBlob(a).includes(stem));
    if (hits.length < FILL_LEVER_REUSE_MIN) continue;
    const orphans = hits.filter((a) => {
      const duties = dutiesForPath(a.path, units);
      return !dutyAllowsLever(duties, dutyNeedles);
    });
    notes.push(
      `fill_lever_reuse:${stem}:hits=${hits.length}:orphans=${orphans.length}`,
    );
    // Orphan lever: stem used on cards whose批断 never asked for that class.
    // Do NOT punish mass reuse when every hit has matching structure duty
    // (e.g. several fire cards all need 降温通关 on a hot chart).
    if (orphans.length >= 2 || (hits.length >= FILL_LEVER_REUSE_MIN && orphans.length >= 1)) {
      return {
        ok: false,
        reason: `fill_lever_reuse:${stem}`,
        notes,
      };
    }
  }
  return { ok: true, notes };
}
