/**
 * P3 plain-judgment fill quality — categories only (iron 14–15).
 * Prompt is primary; this gate verifies the same scale across charts/topics.
 *
 * Lever reuse must match **coach-phrase patterns**, not bare chars like「输出」
 * (those appear in legitimate 疏导通路 / 输出疏导 vernacular and false-red).
 */

/** Near-duplicate angle prose (Han bigram Jaccard). Short means inflate Jaccard — keep moderate. */
export const FILL_ANGLE_COLLAPSE_MAX = 0.32;

/** Same coach-lever pattern on this many angles → collapse (with orphan check). */
export const FILL_LEVER_REUSE_MIN = 3;

/**
 * Life-domain coach scripts that structure-judgment translation must not invent.
 * Domain categories — never chart-specific interview sentences.
 */
export const FILL_PARALLEL_LIFE_STORY_RE =
  /固定资产|流动资产|现金流|资产配置|资产变现|投融资|估值谈判|股权激励|产品路线图|甘特|OKR|KPI看板|情绪管理课|心理咨询|疗愈课程|商业计划书/;

/**
 * Universal-means coach phrases vs structure-duty needles.
 * Bare「输出/降温」are NOT stems — too many false reds on mechanism vernacular.
 */
const FILL_LEVER_PATTERNS: ReadonlyArray<{
  id: string;
  re: RegExp;
  dutyNeedles: readonly string[];
}> = [
  {
    id: "技术输出万能手段",
    re: /技术输出|持续(?:、高质量的)?输出|用输出换|输出换取|把输出当作|输出成为|输出作为(?:一种)?调节|输出当作一种/,
    dutyNeedles: ["输出疏导"],
  },
  {
    id: "分享教学复盘课",
    re: /技术分享|技术复盘|定期(?:写作|演讲|教学)|每周(?:写一篇|分享)/,
    dutyNeedles: ["输出疏导"],
  },
  {
    id: "冷静万能缓冲",
    re: /保持冷静|用冷静|冷静的环境|冷静时段|内心平静|思路清晰的时刻/,
    dutyNeedles: ["降温通关", "有益侧"],
  },
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
  if (duties.length === 0) return true;
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
  for (const { id, re, dutyNeedles } of FILL_LEVER_PATTERNS) {
    const hits = angles.filter((a) => re.test(fillAngleProseBlob(a)));
    if (hits.length < FILL_LEVER_REUSE_MIN) continue;
    notes.push(`fill_lever_reuse:${id}:hits=${hits.length}`);
    // Without evidence units: mass coach-phrase reuse alone is enough (category).
    if (!units?.length) {
      return {
        ok: false,
        reason: `fill_lever_reuse:${id}`,
        notes,
      };
    }
    const orphans = hits.filter((a) => {
      const duties = dutiesForPath(a.path, units);
      return !dutyAllowsLever(duties, dutyNeedles);
    });
    notes.push(`fill_lever_reuse:${id}:orphans=${orphans.length}`);
    if (orphans.length >= 2 || orphans.length >= 1) {
      return {
        ok: false,
        reason: `fill_lever_reuse:${id}`,
        notes,
      };
    }
  }
  return { ok: true, notes };
}
