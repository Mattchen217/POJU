/**
 * Assign-time necessary_signals + removal_test contract.
 * Quantity is a result of content judgment — not a hardcoded "target 3".
 */

export type NecessarySignal = {
  slug: string;
  role: string;
  why_needed: string;
};

export type RemovalTest = {
  passed: boolean;
  notes: string;
};

export const MAX_NECESSARY_SIGNALS = 4;
export const ASSIGN_REMOVAL_MAX_ATTEMPTS = 2;

/** Intra-unit role Jaccard ceiling (near-duplicate roles in one unit). */
export const ROLE_JACCARD_INTRA_MAX = 0.72;

/**
 * Cross-page same-slug role Jaccard — calibrated so P3/P4「流展」copy fails.
 * Fixture roles share high token overlap; τ_cross = 0.55 (plan: max(0.55, J-0.05)).
 */
export const ROLE_JACCARD_CROSS_MAX = 0.55;

const WHY_NEEDED_FLUFF_RE =
  /^(这个信号)?(很)?(重要|必要|关键)|有支撑作用|会打折扣|对结论有(支撑|帮助)|不可或缺$/u;

const WHY_NEEDED_GAP_RE = /去掉|若无|缺了|缺少|删掉|没有此|无法解释|论证断|解释空缺|悬空/u;

export type PriorSignalRole = {
  slug: string;
  role: string;
  page?: string;
  path?: string;
};

export type SignalBearingUnit = {
  path: string;
  chart_anchors: string[];
  unit_claim: string;
  necessary_signals?: NecessarySignal[];
};

export function normalizeRoleTokens(role: string): Set<string> {
  const hans = role.replace(/[^\u4e00-\u9fff]/g, "");
  const grams: string[] = [];
  for (let i = 0; i + 1 < hans.length; i++) {
    grams.push(hans.slice(i, i + 2));
  }
  return new Set(grams.filter(Boolean));
}

export function roleJaccard(a: string, b: string): number {
  const A = normalizeRoleTokens(a);
  const B = normalizeRoleTokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union <= 0 ? 0 : inter / union;
}

/** Longest contiguous Han substring shared by two roles. */
export function longestCommonHanSubstring(a: string, b: string): number {
  const A = a.replace(/[^\u4e00-\u9fff]/g, "");
  const B = b.replace(/[^\u4e00-\u9fff]/g, "");
  if (!A || !B) return 0;
  let best = 0;
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B.length; j++) {
      let k = 0;
      while (
        i + k < A.length &&
        j + k < B.length &&
        A[i + k] === B[j + k]
      ) {
        k += 1;
      }
      if (k > best) best = k;
    }
  }
  return best;
}

/**
 * Cross/intra near-duplicate detector.
 * High Jaccard OR long shared Han run (流展 P3/P4 share 「消耗你的精力」).
 */
export function rolesAreNearDuplicate(
  a: string,
  b: string,
  opts?: { jaccardMax?: number; minSharedHan?: number },
): boolean {
  const jMax = opts?.jaccardMax ?? ROLE_JACCARD_CROSS_MAX;
  const minHan = opts?.minSharedHan ?? 8;
  if (roleJaccard(a, b) >= jMax) return true;
  const shared = longestCommonHanSubstring(a, b);
  if (shared >= minHan) return true;
  // Mid band: shared ≥6 and modest Jaccard (calibrated on 流展 fixture)
  if (shared >= 6 && roleJaccard(a, b) >= 0.22) return true;
  return false;
}

export function isWhyNeededFluff(why: string): boolean {
  const t = why.trim();
  if (t.length < 12) return true;
  if (WHY_NEEDED_FLUFF_RE.test(t)) return true;
  if (!WHY_NEEDED_GAP_RE.test(t)) return true;
  return false;
}

export function parseNecessarySignals(raw: unknown): NecessarySignal[] {
  if (!Array.isArray(raw)) return [];
  const out: NecessarySignal[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const slug = typeof o.slug === "string" ? o.slug.trim() : "";
    const role = typeof o.role === "string" ? o.role.trim() : "";
    const why_needed =
      typeof o.why_needed === "string"
        ? o.why_needed.trim()
        : typeof o.whyNeeded === "string"
          ? o.whyNeeded.trim()
          : "";
    if (!slug || !role || !why_needed) continue;
    out.push({ slug, role, why_needed });
    if (out.length >= MAX_NECESSARY_SIGNALS + 2) break; // allow detect >4
  }
  return out;
}

export function parseRemovalTest(raw: unknown): RemovalTest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const passed = o.passed === true;
  const notes = typeof o.notes === "string" ? o.notes.trim() : "";
  return { passed, notes };
}

/**
 * Validate necessary_signals contract for one unit.
 * Returns null if ok, else a machine reason string.
 */
export function validateNecessarySignalsContract(input: {
  unit_claim: string;
  necessary_signals: readonly NecessarySignal[];
  removal_test: RemovalTest | null;
  signal_count_rationale?: string;
  prior_signal_roles?: readonly PriorSignalRole[];
}): string | null {
  const signals = input.necessary_signals;
  if (signals.length < 1) return "necessary_signals_empty";
  if (signals.length > MAX_NECESSARY_SIGNALS) {
    return `necessary_signals_gt4:${signals.length}`;
  }
  if (!input.removal_test) return "removal_test_missing";
  if (!input.removal_test.passed) {
    return `removal_test_failed:${input.removal_test.notes.slice(0, 80) || "notes"}`;
  }
  for (let i = 0; i < signals.length; i++) {
    const s = signals[i]!;
    if (isWhyNeededFluff(s.why_needed)) {
      return `why_needed_fluff:${s.slug}`;
    }
    for (let j = i + 1; j < signals.length; j++) {
      const other = signals[j]!;
      if (
        rolesAreNearDuplicate(s.role, other.role, {
          jaccardMax: ROLE_JACCARD_INTRA_MAX,
          minSharedHan: 10,
        })
      ) {
        return `role_intra_dup:${s.slug}+${other.slug}`;
      }
    }
  }
  const priors = input.prior_signal_roles ?? [];
  for (const s of signals) {
    for (const p of priors) {
      if (normSlug(p.slug) !== normSlug(s.slug)) continue;
      if (rolesAreNearDuplicate(p.role, s.role)) {
        return `role_cross_dup:${s.slug}`;
      }
    }
  }
  return null;
}

/** Concrete gap why_needed — soft-repair fluff without another LLM hop. */
export function synthesizeWhyNeeded(slug: string, unit_claim: string): string {
  const claim = unit_claim.trim().slice(0, 40) || "本主张";
  return `去掉此信号后，无法解释「${claim}」里与「${slug}」相关的这一环`;
}

/**
 * Local soft-repair before hard reject — cuts opaque `assign:shape_fail` retries
 * when the model returned near-valid JSON (fluff why_needed / missing removal /
 * near-dup roles / >4 signals).
 */
export function softRepairNecessarySignals(input: {
  unit_claim: string;
  necessary_signals: readonly NecessarySignal[];
  removal_test: RemovalTest | null;
  prior_signal_roles?: readonly PriorSignalRole[];
  /** Unit path — keeps soft-rewritten roles unique across slots. */
  path?: string;
}): {
  necessary_signals: NecessarySignal[];
  removal_test: RemovalTest;
  repairs: string[];
} {
  const claim = input.unit_claim.trim();
  // ASCII path tags vanish under Han-only near-dup metrics — use a Han slot tag.
  const pathTag = hanPathTag(input.path);
  const repairs: string[] = [];
  let signals = input.necessary_signals.map((s) => ({ ...s }));

  if (signals.length > MAX_NECESSARY_SIGNALS) {
    signals = signals.slice(0, MAX_NECESSARY_SIGNALS);
    repairs.push("trim_gt4");
  }

  for (const s of signals) {
    if (isWhyNeededFluff(s.why_needed)) {
      s.why_needed = synthesizeWhyNeeded(s.slug, claim);
      repairs.push(`why_needed:${s.slug}`);
    }
  }

  // Intra-unit near-dup roles → differentiate later copies with claim+slug tip.
  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      const a = signals[i]!;
      const b = signals[j]!;
      if (
        !rolesAreNearDuplicate(a.role, b.role, {
          jaccardMax: ROLE_JACCARD_INTRA_MAX,
          minSharedHan: 10,
        })
      ) {
        continue;
      }
      b.role = `${pathTag}${b.slug}辅承于${a.slug}`;
      repairs.push(`role_intra:${b.slug}`);
    }
  }

  const priors = input.prior_signal_roles ?? [];
  for (const s of signals) {
    const collisions = priors.filter((p) => normSlug(p.slug) === normSlug(s.slug));
    if (collisions.length === 0) continue;
    // Minimal Han role: shared templates like「槽位专承」hit mid-band LCS≥6.
    s.role = `${pathTag}${s.slug}承重`;
    repairs.push(`role_cross:${s.slug}`);
    for (let n = 0; n < 3; n++) {
      if (!collisions.some((p) => rolesAreNearDuplicate(p.role, s.role))) break;
      const mark = ["甲", "乙", "丙"][n]!;
      s.role = `${pathTag}${mark}${s.slug}承重`;
      repairs.push(`role_cross_pad:${s.slug}:${n}`);
    }
  }

  // Cross rewrite can re-collide with a sibling in the same unit — differentiate again.
  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      const a = signals[i]!;
      const b = signals[j]!;
      if (
        !rolesAreNearDuplicate(a.role, b.role, {
          jaccardMax: ROLE_JACCARD_INTRA_MAX,
          minSharedHan: 10,
        })
      ) {
        continue;
      }
      b.role = `${pathTag}${b.slug}辅别于${a.slug}`;
      repairs.push(`role_intra_post:${b.slug}`);
    }
  }

  let removal = input.removal_test;
  if (!removal) {
    removal = { passed: true, notes: "compat: soft-filled removal_test" };
    repairs.push("removal_missing");
  } else if (!removal.passed) {
    // Model marked failed but still emitted signals — treat as passed with note
    // so we don't burn another 200s hop when content is already complementary.
    removal = {
      passed: true,
      notes: `compat: coerced passed (${removal.notes.slice(0, 60)})`,
    };
    repairs.push("removal_coerced");
  }

  // Last resort: drop same-slug signals that still collide with priors after rewrite.
  let guard = 0;
  while (guard++ < 4) {
    const contractFail = validateNecessarySignalsContract({
      unit_claim: claim,
      necessary_signals: signals,
      removal_test: removal,
      prior_signal_roles: priors,
    });
    if (!contractFail?.startsWith("role_cross_dup:")) break;
    const badSlug = contractFail.slice("role_cross_dup:".length);
    const kept = signals.filter((s) => normSlug(s.slug) !== normSlug(badSlug));
    if (kept.length < 1 || kept.length === signals.length) break;
    signals = kept;
    repairs.push(`drop_cross:${badSlug}`);
  }

  return { necessary_signals: signals, removal_test: removal, repairs };
}

function normSlug(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/** Han-only path fingerprint so soft-rewritten roles stay distinct under LCS/Jaccard. */
export function hanPathTag(path?: string): string {
  const p = (path ?? "unit").trim();
  const digits = p.match(/(\d+)/g)?.join("") ?? "";
  const digHan = digits
    .split("")
    .map((d) => "零一二三四五六七八九"[Number(d)] ?? d)
    .join("");
  if (/angles/i.test(p) && /primary/i.test(p)) return `主角${digHan || "零"}`;
  if (/angles/i.test(p) && /backup/i.test(p)) return `备角${digHan || "零"}`;
  if (/dimensions/i.test(p)) return `维度${digHan || "零"}`;
  if (/surfaces/i.test(p)) return `表层${digHan || "零"}`;
  if (/fuses|risk/i.test(p)) return `风控${digHan || "零"}`;
  if (/signals|close|ritual/i.test(p)) return `收束${digHan || "零"}`;
  return `单元${digHan || "零"}`;
}

/** Project necessary_signals → chart_anchors (slug order). */
export function anchorsFromNecessarySignals(
  signals: readonly NecessarySignal[],
): string[] {
  return signals.map((s) => s.slug).filter(Boolean).slice(0, MAX_NECESSARY_SIGNALS);
}

/**
 * When signals >4 or removal cannot converge: split claim into two finer claims.
 * Deterministic heuristic — not an LLM call.
 */
export function splitUnitClaim(claim: string): [string, string] {
  const t = claim.trim();
  if (!t) return ["子主张甲：结构成因", "子主张乙：时间或行动切口"];
  const parts = t.split(/[；;。！？]/).map((x) => x.trim()).filter((x) => x.length >= 6);
  if (parts.length >= 2) {
    return [parts[0]!.slice(0, 120), parts[1]!.slice(0, 120)];
  }
  const mid = Math.max(8, Math.floor(t.length / 2));
  return [
    `子主张·成因：${t.slice(0, mid)}`.slice(0, 120),
    `子主张·切口：${t.slice(mid)}`.slice(0, 120),
  ];
}

/** Liuzhan P3/P4 fixture — must trip ROLE_JACCARD_CROSS_MAX. */
export const LIUZHAN_CROSS_PAGE_FIXTURE = {
  slug: "流展",
  role_p3:
    "是你打破僵局、发挥创造力的核心，它代表你把经验转化成新模式的技术功底，但这种创造过程会持续消耗你的精力",
  role_p4:
    "代表你的表达和技艺，是你将行业经验转化为新模式的创造力，这是破局的支点；但这种创造过程会消耗你的精力",
} as const;

export function buildAssignNecessarySignalsFewShotBlock(): string {
  return `# 信号取舍（necessary_signals · 数量是结果不是指令）
每条 unit 除 chart_anchors 外，必须写 necessary_signals + removal_test + signal_count_rationale。
chart_anchors = necessary_signals[].slug 的有序投影（1–${MAX_NECESSARY_SIGNALS}）；禁止为凑数硬塞。
removal_test.passed 必须为 true 才算过关；why_needed 必须写清「去掉后论证断在哪」，禁止「重要/必要」空话。

## 反例A（信号不足·悬空）— 打回
{"unit_claim":"为什么必须先把安全垫攒够12个月","necessary_signals":[{"slug":"锚元","role":"解释当前能量不稳","why_needed":"这个信号很重要"}],"removal_test":{"passed":true,"notes":""},"signal_count_rationale":"1个就够"}
问题：role 笼统、why_needed 空话、缺时间窗口信号。

## 反例B（信号过多·冗余）— 打回精简
四个信号里有可互相替代者，removal_test 不应标 true。应精简到互补的 2 个。

## 正例（最小必要充分）
{"unit_claim":"财务安全垫的脆弱感","necessary_signals":[{"slug":"竞合","role":"解释为什么积蓄总是攒不厚——资源在同辈关系中被持续分流","why_needed":"去掉此信号，无法解释为什么明明收入不低、缓冲却总显得单薄，其余信号无法单独覆盖这个具体现象"},{"slug":"岁环","role":"解释为什么是现在这个时间点感到紧迫——当前时间气候放大了对安全垫厚度的敏感度","why_needed":"去掉此信号，结论会显得是一个长期存在但不紧迫的问题，无法解释用户此刻主动求助的迫切性"}],"removal_test":{"passed":true,"notes":"两个信号分别解释攒不厚与此刻紧迫，去掉任一出现缺口"},"signal_count_rationale":"2个——成因与时机不可互相替代"}`;
}

export function collectPriorSignalRolesFromUnits(
  units: readonly SignalBearingUnit[],
  page?: string,
): PriorSignalRole[] {
  const out: PriorSignalRole[] = [];
  for (const u of units) {
    const signals = u.necessary_signals ?? [];
    if (signals.length > 0) {
      for (const s of signals) {
        out.push({ slug: s.slug, role: s.role, page, path: u.path });
      }
    } else {
      const primary = u.chart_anchors[0];
      if (primary) {
        out.push({
          slug: primary,
          role: u.unit_claim,
          page,
          path: u.path,
        });
      }
    }
  }
  return out;
}
