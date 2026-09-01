/**
 * Wide-in / strict-out sanitize for delivery page JSON.
 * Truncate & default — never LLM-retry for length issues.
 * Structural failure (missing required tracks) is signaled for retry.
 */

import type { DeliverySegmentKey } from "../delivery-schema";
import { DELIVERY_PAGE_TAGS } from "../delivery-schema";
import {
  DeliveryPageSchemaByKey,
  type DeliveryPageData,
  type DimLevel,
  type TrackRole,
} from "./types";
import { ensureProseParagraphBreaks } from "./prose-paragraphs";
import {
  assessUnitAnchorQuality,
  collectPageAnchorUnits,
} from "./anchor-quality";
import {
  isP4EasternSanitizeTag,
  remapP4DimensionNameForCompliance,
  scrubP4UserVisibleProse,
} from "./p4-compliance-dim-names";
import { noteP4DestinyGrounding } from "./destiny-grounding";
import { gateP4DimensionMeans } from "./p4-means-gate";

export type SanitizeOk = {
  ok: true;
  page: DeliveryPageData;
  truncated: boolean;
  notes: string[];
};

export type SanitizeFail = {
  ok: false;
  structural: true;
  reason: string;
  notes: string[];
};

export type SanitizeResult = SanitizeOk | SanitizeFail;

function asObj(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function clip(s: unknown, max: number): string {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function clipOpt(s: unknown, max: number): string | undefined {
  const t = String(s ?? "").trim();
  if (!t) return undefined;
  return clip(t, max);
}

function arrClip(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, maxItems)
    .map((x) => clip(x, maxLen))
    .filter((x) => x.length > 0);
}

function parseChartAnchors(v: unknown, maxItems = 8): string[] {
  return arrClip(v, maxItems, 48);
}

function unitMissingAnchors(anchors: string[] | undefined): boolean {
  return !anchors || anchors.length < 1;
}

/** Wide-in: object RiskItem or legacy plain string → structured row + optional narrative. */
export function coerceRiskItem(
  v: unknown,
  maxField: number = 160,
): {
  situation: string;
  then_do: string;
  watch: string;
  forbid: string;
  narrative?: string;
  chart_anchors: string[];
} | null {
  const o = asObj(v);
  if (o) {
    const narrative = clipOpt(
      o.narrative ?? o.body ?? o.prose ?? o.story ?? o.paragraph,
      720,
    );
    let situation = clip(
      o.situation ?? o.signal ?? o.when ?? o.trigger ?? o.text ?? o.title,
      maxField,
    );
    // Narrative-only wide-in: keep a short situation stub for evidence keys.
    if (!situation && narrative) {
      situation = clip(narrative, Math.min(maxField, 120));
    }
    if (!situation) return null;
    const then_do =
      clip(o.then_do ?? o.do ?? o.action ?? o.response ?? o.next, maxField) ||
      (narrative ? clip(narrative, maxField) : "") ||
      "停机并降档，先处理这条信号。";
    const watch =
      clip(o.watch ?? o.caution ?? o.note ?? o.observe, maxField) ||
      "观察是否连响或与其他红灯叠加。";
    const forbid =
      clip(o.forbid ?? o.dont ?? o.avoid ?? o.ban, maxField) ||
      "禁止假装没事继续硬冲。";
    return {
      situation,
      then_do,
      watch,
      forbid,
      ...(narrative ? { narrative } : {}),
      chart_anchors: parseChartAnchors(o.chart_anchors ?? o.anchors ?? o.bazi_basis),
    };
  }
  const situation = clip(v, maxField);
  if (!situation) return null;
  return {
    situation,
    then_do: "停机并降档，先处理这条信号。",
    watch: "观察是否连响或与其他红灯叠加。",
    forbid: "禁止假装没事继续硬冲。",
    chart_anchors: [],
  };
}

function arrRiskItems(v: unknown, maxItems: number, maxField: number) {
  if (!Array.isArray(v)) {
    return [] as Array<{
      situation: string;
      then_do: string;
      watch: string;
      forbid: string;
      narrative?: string;
    }>;
  }
  const out: Array<{
    situation: string;
    then_do: string;
    watch: string;
    forbid: string;
    narrative?: string;
  }> = [];
  for (const item of v.slice(0, maxItems)) {
    const row = coerceRiskItem(item, maxField);
    if (row) out.push(row);
  }
  return out;
}

function coerceSwitchItem(v: unknown, maxField: number) {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") {
    return coerceRiskItem(
      {
        situation: String(v),
        then_do: "冻结主路径推进，切换到辅路径并执行辅路径已定动作。",
        watch: "确认辅路径动作已启动，主路径不再加塞。",
        forbid: "禁止红灯已亮仍继续硬谈主路径。",
      },
      maxField,
    );
  }
  return coerceRiskItem(v, maxField);
}

/** Wide-in: Day7 object or legacy plain string → structured checklist row. */
export function coerceDay7Item(
  v: unknown,
  maxAction = 100,
): {
  action: string;
  why: string;
  done_when: string;
} | null {
  const o = asObj(v);
  if (o) {
    const action = clip(o.action ?? o.do ?? o.task ?? o.text ?? o.title, maxAction);
    if (!action) return null;
    const why =
      clip(o.why ?? o.reason ?? o.because, 120) || "服务本案近阶，不另开药方。";
    const done_when =
      clip(o.done_when ?? o.done ?? o.tick ?? o.criteria, 80) || "做完可勾。";
    return { action, why, done_when };
  }
  const action = clip(v, maxAction);
  if (!action) return null;
  return {
    action,
    why: "服务本案近阶，不另开药方。",
    done_when: "做完可勾。",
  };
}

function arrDay7Items(v: unknown, maxItems: number) {
  if (!Array.isArray(v)) {
    return [] as Array<{ action: string; why: string; done_when: string }>;
  }
  const out: Array<{ action: string; why: string; done_when: string }> = [];
  for (const item of v.slice(0, maxItems)) {
    const row = coerceDay7Item(item);
    if (row) out.push(row);
  }
  return out;
}

function coerceTakeaways(v: unknown): [string, string, string] | null {
  if (!Array.isArray(v)) return null;
  const clipped = v
    .slice(0, 3)
    .map((x) => clip(x, 80))
    .filter((x) => x.length > 0);
  if (clipped.length < 3) return null;
  return [clipped[0]!, clipped[1]!, clipped[2]!];
}

function mapDim(v: unknown): DimLevel {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (s === "high" || s === "h" || s === "高") return "high";
  if (s === "mid" || s === "medium" || s === "m" || s === "中") return "mid";
  if (s === "low" || s === "l" || s === "低") return "low";
  return "unknown";
}

function mapRole(v: unknown, fallback: TrackRole): TrackRole {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (s === "primary" || s === "main" || s === "主" || s === "主路径") return "primary";
  if (s === "backup" || s === "aux" || s === "辅" || s === "辅路径") return "backup";
  return fallback;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Placeholder / UI-chrome notes that often pair with fake score=0. */
const FAKE_DASH_NOTE_RE =
  /来自仪表盘|from\s*dashboard|来自\s*pack|from\s*pack|^—$|^-$|暂缺|empty_note/i;

/**
 * Kill fake "0 · 来自仪表盘" facade: score 0 + empty/placeholder note → null.
 * Real pack zeros with a concrete note are kept.
 * When allowedScores is set, score must be null or one of the pack true scores.
 */
function sanitizeDashboardMetric(
  score: number | null,
  note: string | undefined,
  notes: string[],
  allowedScores?: readonly number[] | null,
): { score: number | null; note?: string } {
  let s = score;
  let n = note?.trim() || undefined;
  const placeholder = !n || FAKE_DASH_NOTE_RE.test(n);
  if (s === 0 && placeholder) {
    notes.push("null_fake_dashboard_zero");
    s = null;
    n = "本盘暂缺量化档";
  } else if (n && /来自仪表盘|from\s*dashboard/i.test(n) && (s === null || s === 0)) {
    notes.push("scrub_dashboard_chrome_note");
    n = "本盘暂缺量化档";
  }
  if (allowedScores && allowedScores.length === 0 && s !== null) {
    notes.push("null_dashboard_no_true_scores");
    s = null;
  } else if (allowedScores && allowedScores.length > 0 && s !== null) {
    if (!allowedScores.includes(s)) {
      notes.push(`null_dashboard_score_not_in_pack:${s}`);
      s = null;
    }
  }
  return { score: s, note: n };
}

/** Parse pack true scores from buildDashboardScoreHintsForFill text. */
export function parseAllowedDashboardScoresFromHints(
  hints: string | null | undefined,
): number[] | null {
  const t = hints?.trim() ?? "";
  if (!t) return null;
  if (/无可用真分|全部 null|score=null/i.test(t) && !/output_capacity=\d+/.test(t)) {
    return [];
  }
  const nums = [...t.matchAll(/(?:output_capacity|sustain_capacity|resistance_load)=(\d+)/g)].map(
    (m) => Number(m[1]),
  );
  const uniq = [...new Set(nums.filter((n) => Number.isFinite(n)))];
  return uniq.length > 0 ? uniq : null;
}

/** Prefer human zh labels when model emits English chrome on a Chinese note context. */
function localizeDashboardLabel(key: string, label: string, note?: string): string {
  const zhCtx = /[\u4e00-\u9fff]/.test(`${note ?? ""}${label}`);
  if (!zhCtx) return label;
  const k = key.trim().toLowerCase();
  const looksEn =
    /body\s*load|mind\s*strain|field\s*friction|output|sustain|resistance/i.test(label) ||
    (/^[a-z][a-z\s/_-]*$/i.test(label) && /body|mind|field|load|strain|friction/i.test(label));
  if (!looksEn && label.trim()) return label;
  if (/body|output|负荷|身体/.test(k) || /body/i.test(label)) return "身体负荷";
  if (/mind|sustain|续航|心力/.test(k) || /mind/i.test(label)) return "续航心力";
  if (/field|resistance|阻力|场域/.test(k) || /field/i.test(label)) return "外部阻力";
  return label;
}

/** Prompt-instruction scraps that must never ship in user-facing slots. */
const PROMPT_LEAK_LINE_RE =
  /^(Lead with\b|Do not write a full legal\b|Here only openings\b|Do not invent\b)/i;

function scrubPromptLeakText(s: string | undefined, notes: string[]): string | undefined {
  if (!s) return undefined;
  let t = s.trim();
  if (!t) return undefined;
  if (PROMPT_LEAK_LINE_RE.test(t) || /Do not write a full legal/i.test(t)) {
    notes.push("scrub_prompt_leak_line");
    return undefined;
  }
  const before = t;
  t = t
    .replace(/\bLead with[^.。!！?]{0,100}[.。!！?]?/gi, "")
    .replace(/\bDo not write a full legal[^.。!！?]{0,120}[.。!！?]?/gi, "")
    .replace(/成本降了\s*X\s*%/gi, "成本降了（填实测%）")
    .replace(/差错率\s*Y\s*%/gi, "差错率（填实测%）")
    .replace(/省下\s*Z\s*%/gi, "省下（填实测%）")
    .replace(/\bX\s*%\s*[\/、]\s*Y\s*%\s*[\/、]\s*Z\s*%/gi, "（两组实测口径）")
    .replace(/\bX\s*%\s*[\/、]\s*Y\s*%/gi, "（填实测%）")
    .trim();
  if (t !== before) notes.push("scrub_prompt_leak_inline");
  return t || undefined;
}

function sanitizeTrack(
  raw: unknown,
  role: TrackRole,
  notes: string[],
): Record<string, unknown> | null {
  const o = asObj(raw);
  if (!o) {
    notes.push(`missing_${role}_track`);
    return null;
  }
  const dimsRaw = asObj(o.dims) ?? {};
  // Leave headroom for \n\n inserted by paragraph normalize (Zod max 720).
  const core_logic_raw = clip(
    o.core_logic ?? o.logic ?? o.approach ?? o.deep_why ?? o.playbook ?? o.summary,
    700,
  );
  const core_logic = core_logic_raw
    ? clip(ensureProseParagraphBreaks(core_logic_raw), 720)
    : "";
  if (!core_logic) {
    notes.push(`${role}_missing_core_logic`);
    return null;
  }
  const why = clip(o.why ?? o.reason ?? o.rationale, 240) || "—";
  const chart_anchors = parseChartAnchors(o.chart_anchors ?? o.anchors ?? o.bazi_basis);
  return {
    role: mapRole(o.role, role),
    name: clip(o.name ?? o.title ?? o.label, 80) || (role === "primary" ? "Primary path" : "Backup path"),
    core_logic,
    why,
    when: clip(o.when ?? o.condition ?? o.if, 240) || "—",
    chart_anchors,
    strategic_goal: clipOpt(
      o.strategic_goal ?? o.goal ?? o.matrix_goal ?? o.objective,
      160,
    ),
    leverage_chip: clipOpt(o.leverage_chip ?? o.chip ?? o.leverage ?? o.bargain, 160),
    dims: {
      body: mapDim(dimsRaw.body ?? dimsRaw.physical),
      mind: mapDim(dimsRaw.mind ?? dimsRaw.mental),
      field: mapDim(dimsRaw.field ?? dimsRaw.environment),
    },
  };
}

function sanitizeAngle(
  raw: unknown,
  notes: string[],
  tag: string,
): Record<string, unknown> | null {
  const o = asObj(raw);
  if (!o) {
    notes.push(`${tag}_not_object`);
    return null;
  }
  const meansRaw = o.means ?? o.steps ?? o.methods ?? o.actions;
  let means = arrClip(meansRaw, 6, 240);
  // Wide-in: { text, type } objects → text for non-P4 / pre-gate
  if (Array.isArray(meansRaw) && means.length === 0) {
    means = meansRaw
      .map((item) => {
        if (typeof item === "string") return item.trim().slice(0, 240);
        if (item && typeof item === "object") {
          const t = String(
            (item as { text?: unknown; body?: unknown }).text ??
              (item as { body?: unknown }).body ??
              "",
          ).trim();
          return t.slice(0, 240);
        }
        return "";
      })
      .filter(Boolean)
      .slice(0, 6);
  }
  const scriptRaw = scrubPromptLeakText(
    clipOpt(o.exact_script ?? o.script ?? o.opening_line, 160),
    notes,
  );
  // Fold legacy「开口」into means — no separate exact_script slot in UI.
  if (scriptRaw) {
    const already = means.some((m) => m.includes(scriptRaw.slice(0, 24)));
    if (!already) {
      means = [`可复述：${scriptRaw}`, ...means].slice(0, 6);
      notes.push("fold_exact_script_into_means");
    }
  }
  if (means.length === 0 && !Array.isArray(meansRaw)) {
    notes.push(`${tag}_no_means`);
    return null;
  }
  const p4 = isP4EasternSanitizeTag(tag);
  let name = clip(o.name ?? o.title ?? o.label, 80) || tag;
  let strategy = clip(
    ensureProseParagraphBreaks(
      scrubPromptLeakText(
        clip(o.strategy ?? o.approach ?? o.why, 540) || "—",
        notes,
      ) || "—",
    ),
    560,
  );
  let meansOut = means;
  let metrics = arrClip(o.hard_metrics ?? o.metrics ?? o.kpis, 4, 160).map(
    (m) => scrubPromptLeakText(m, notes) || m,
  );
  const chart_anchors = parseChartAnchors(o.chart_anchors ?? o.anchors ?? o.bazi_basis);
  if (p4) {
    const remapped = remapP4DimensionNameForCompliance(name);
    if (remapped !== name) {
      notes.push("p4_dim_name_compliance_remap");
      name = remapped;
    }
    const s2 = scrubP4UserVisibleProse(strategy);
    if (s2 !== strategy) {
      notes.push("p4_prose_gateway_scrub");
      strategy = s2;
    }
    const gated = gateP4DimensionMeans({
      meansRaw: meansRaw ?? means,
      chart_anchors,
      strategy,
      notes: [],
    });
    notes.push(...gated.notes);
    if (gated.structural) {
      notes.push(gated.structural_reason ?? "p4_means_gate_fail");
      return null;
    }
    meansOut = gated.means.map((m) => {
      const m2 = scrubP4UserVisibleProse(m);
      if (m2 !== m) notes.push("p4_prose_gateway_scrub");
      return m2;
    });
    if (meansOut.length === 0) {
      notes.push(`${tag}_no_means_after_gate`);
      return null;
    }
    metrics = metrics.map((m) => scrubP4UserVisibleProse(m));
  }
  return {
    name,
    strategy,
    means: meansOut,
    chart_anchors,
    hard_metrics: metrics,
  };
}

function sanitizeAnglesList(
  rawList: unknown,
  legacy: Record<string, unknown> | null,
  notes: string[],
  tag: string,
  minCount: number,
): Record<string, unknown>[] | null {
  const fromArr = Array.isArray(rawList) ? rawList : [];
  const angles: Record<string, unknown>[] = [];
  for (let i = 0; i < fromArr.length && angles.length < 6; i++) {
    const a = sanitizeAngle(fromArr[i], notes, `${tag}_angle_${i}`);
    if (a) angles.push(a);
  }
  // Legacy wide-in: single strategy + steps/methods → one angle
  if (angles.length === 0 && legacy) {
    const a = sanitizeAngle(
      {
        name: legacy.title ?? legacy.name ?? tag,
        strategy: legacy.strategy ?? legacy.approach,
        means: legacy.means ?? legacy.steps ?? legacy.methods,
        exact_script: legacy.exact_script,
        hard_metrics: legacy.hard_metrics,
      },
      notes,
      `${tag}_legacy`,
    );
    if (a) angles.push(a);
  }
  if (angles.length < minCount) {
    notes.push(`${tag}_angles_lt_${minCount}`);
    return null;
  }
  const maxKeep = minCount >= 3 ? 5 : 6;
  return angles.slice(0, maxKeep);
}

function sanitizeToolkit(
  raw: unknown,
  role: TrackRole,
  notes: string[],
): Record<string, unknown> | null {
  const o = asObj(raw);
  if (!o) {
    notes.push(`missing_${role}_toolkit`);
    return null;
  }
  const angles = sanitizeAnglesList(
    o.angles ?? o.strategies ?? o.paths,
    o,
    notes,
    `${role}_toolkit`,
    3,
  );
  if (!angles) return null;
  return {
    role: mapRole(o.role, role),
    title:
      clip(o.title ?? o.name, 100) ||
      (role === "primary" ? "Primary toolkit" : "Backup toolkit"),
    angles,
  };
}

function sanitizeEastern(
  raw: unknown,
  role: TrackRole,
  notes: string[],
): Record<string, unknown> | null {
  const o = asObj(raw);
  if (!o) {
    notes.push(`missing_${role}_eastern`);
    return null;
  }
  const dimensions = sanitizeAnglesList(
    o.dimensions ?? o.angles ?? o.dims_list,
    o,
    notes,
    `${role}_eastern`,
    1,
  );
  if (!dimensions) return null;
  return {
    role: mapRole(o.role, role),
    title:
      clip(o.title ?? o.name, 100) ||
      (role === "primary" ? "Primary eastern track" : "Backup eastern track"),
    dimensions,
  };
}

function sanitizeEvidence(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 16).map((item) => {
    const o = asObj(item) ?? {};
    return {
      field_path: clip(o.field_path ?? o.path ?? "body", 80) || "body",
      markers: arrClip(o.markers ?? o.tags, 8, 40),
      gloss: clipOpt(o.gloss, 280),
    };
  });
}

/** Soften legal courtroom tone in dynamic page chrome (model often echoes 裁定). */
function scrubLegalToneInChrome(text: string): string {
  return text
    .replace(/双轨裁定/g, "双轨决策")
    .replace(/取舍裁定/g, "取舍决策")
    .replace(/推演裁定/g, "推演决策")
    .replace(/裁定/g, "决策")
    .replace(/裁决/g, "决策")
    .replace(/判决书/g, "结论")
    .replace(/判决/g, "判断");
}

/** Attach dynamic page chrome; fallback title = fixed tag (zh). */
function attachPageChrome(
  key: DeliverySegmentKey,
  root: Record<string, unknown>,
  candidate: Record<string, unknown>,
): void {
  const fallback = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  const title = scrubLegalToneInChrome(
    clip(root.page_title ?? root.headline ?? root.main_title, 56) || fallback,
  );
  const subtitle = scrubLegalToneInChrome(
    clip(root.page_subtitle ?? root.subtitle ?? root.subhead, 80),
  );
  candidate.page_title = title;
  candidate.page_subtitle = subtitle;
}

/**
 * Coerce loose LLM JSON into a shape ready for Zod safeParse.
 * Returns structural failure if required tracks/fields cannot be recovered.
 */
export function sanitizePageJson(
  key: DeliverySegmentKey,
  raw: unknown,
  opts?: {
    allowedDashboardScores?: readonly number[] | null;
    eastern_calc_slice?: string | null;
  },
): SanitizeResult {
  const notes: string[] = [];
  let truncated = false;
  const root = asObj(raw);
  if (!root) {
    return { ok: false, structural: true, reason: "not_object", notes };
  }

  let candidate: Record<string, unknown>;

  switch (key) {
    case "direct_answer": {
      const primary = sanitizeTrack(root.primary ?? root.main ?? root.track_a, "primary", notes);
      const backup = sanitizeTrack(root.backup ?? root.aux ?? root.track_b, "backup", notes);
      if (!primary || !backup) {
        return {
          ok: false,
          structural: true,
          reason: "missing_primary_or_backup_track",
          notes,
        };
      }
      const judgment = clip(root.core_judgment ?? root.judgment ?? root.answer, 220);
      if (!judgment) {
        return { ok: false, structural: true, reason: "missing_core_judgment", notes };
      }
      if (String(root.core_judgment ?? "").length > 220) truncated = true;
      candidate = {
        page: "direct_answer",
        core_judgment: judgment,
        primary,
        backup,
        evidence: sanitizeEvidence(root.evidence),
      };
      break;
    }
    case "foundation": {
      const sve = asObj(root.surface_vs_essence) ?? asObj(root.surface_vs_core) ?? {};
      const pageSurface = clip(sve.surface ?? root.surface, 280);
      const pageEssence = clip(sve.essence ?? sve.core ?? root.essence, 480);
      const dashRaw = Array.isArray(root.dashboard) ? root.dashboard : [];
      const allowed = opts?.allowedDashboardScores;
      const dashboard = dashRaw.slice(0, 8).map((item, i) => {
        const o = asObj(item) ?? {};
        const key = clip(o.key ?? `m${i}`, 40) || `m${i}`;
        const cleaned = sanitizeDashboardMetric(
          numOrNull(o.score ?? o.value),
          clipOpt(o.note, 160),
          notes,
          allowed,
        );
        const rawLabel = clip(o.label ?? o.name ?? o.key, 60) || `Metric ${i + 1}`;
        return {
          key,
          label: localizeDashboardLabel(key, rawLabel, cleaned.note),
          score: cleaned.score,
          note: cleaned.note,
        };
      });
      if (dashboard.length === 0) {
        notes.push("dashboard_retired_stub");
        dashboard.push(
          { key: "body", label: "身体负荷", score: null, note: undefined },
          { key: "mind", label: "续航心力", score: null, note: undefined },
          { key: "field", label: "外部阻力", score: null, note: undefined },
        );
      }
      const whySrc = Array.isArray(root.why_cards)
        ? root.why_cards
        : Array.isArray(root.cards)
          ? root.cards
          : [];
      let why_cards = whySrc.slice(0, 5).map((item, i) => {
        const o = asObj(item) ?? {};
        const title = clip(o.title ?? o.heading, 80) || `Why ${i + 1}`;
        const surface = clip(o.surface ?? o.symptom, 280);
        const essence = clip(o.essence ?? o.body ?? o.text ?? o.content, 480);
        const chart_anchors = parseChartAnchors(
          o.chart_anchors ?? o.anchors ?? o.bazi_basis,
        );
        return { title, surface, essence, chart_anchors };
      });

      // Legacy: page-level pair + body-only cards → multi-surface cards
      const missingSurfaces = why_cards.filter((c) => !c.surface).length;
      if (missingSurfaces > 0 && pageSurface && pageEssence) {
        notes.push("legacy_multi_surface_from_page_pair");
        if (why_cards.length === 0) {
          why_cards = [
            {
              title: "总对照",
              surface: pageSurface,
              essence: pageEssence,
              chart_anchors: [],
            },
          ];
        } else {
          why_cards = why_cards.map((c, i) => ({
            title: c.title,
            surface:
              c.surface ||
              (i === 0 ? pageSurface : clip(`${c.title}: ${pageSurface}`, 280)) ||
              pageSurface,
            essence: c.essence || (i === 0 ? pageEssence : c.essence) || pageEssence,
            chart_anchors: c.chart_anchors,
          }));
          // Prefer promoting page pair as its own first card when first card had no surface
          const firstRaw = asObj(whySrc[0]) ?? {};
          if (!clip(firstRaw.surface, 280) && why_cards[0]) {
            why_cards = [
              {
                title: "总对照",
                surface: pageSurface,
                essence: pageEssence,
                chart_anchors: [],
              },
              ...why_cards.map((c) => ({
                ...c,
                surface: c.surface || pageSurface,
                essence: c.essence || "—",
              })),
            ].slice(0, 5);
          }
        }
      }

      why_cards = why_cards.filter((c) => Boolean(c.surface && c.essence && c.essence !== "—"));
      if (why_cards.length < 4) {
        return { ok: false, structural: true, reason: "why_cards_lt_4", notes };
      }
      const thinEssence = why_cards.find((c) => c.essence.trim().length < 60);
      if (thinEssence) {
        return { ok: false, structural: true, reason: "why_card_essence_too_thin", notes };
      }
      if (why_cards.some((c) => !c.surface || !c.essence)) {
        return { ok: false, structural: true, reason: "missing_surface_or_essence", notes };
      }
      candidate = {
        page: "foundation",
        dashboard,
        why_cards: why_cards.slice(0, 5),
        evidence: sanitizeEvidence(root.evidence),
      };
      break;
    }
    case "science_action": {
      const primary_toolkit = sanitizeToolkit(
        root.primary_toolkit ?? root.primary ?? root.main_toolkit,
        "primary",
        notes,
      );
      const backup_toolkit = sanitizeToolkit(
        root.backup_toolkit ?? root.backup ?? root.aux_toolkit,
        "backup",
        notes,
      );
      if (!primary_toolkit || !backup_toolkit) {
        return {
          ok: false,
          structural: true,
          reason: "missing_primary_or_backup_toolkit",
          notes,
        };
      }
      candidate = {
        page: "science_action",
        opening: scrubPromptLeakText(clipOpt(root.opening ?? root.intro, 200), notes),
        primary_toolkit,
        backup_toolkit,
        // alert retired — medical disclaimer / generic caution no longer on user page
        evidence: sanitizeEvidence(root.evidence),
      };
      if (clipOpt(root.alert ?? root.warning, 240)) {
        notes.push("drop_retired_p3_alert");
      }
      break;
    }
    case "metaphysics_action": {
      // leverage / avoid / field_matrix retired from UI — keep empty (wide-in drop).
      const leverage: string[] = [];
      const avoid: string[] = [];
      if (arrClip(root.leverage ?? root.borrow, 5, 200).length > 0) {
        notes.push("drop_retired_p4_leverage");
      }
      if (arrClip(root.avoid ?? root.pitfalls, 5, 200).length > 0) {
        notes.push("drop_retired_p4_avoid");
      }

      // Preferred: flat dimensions. Legacy wide-in: merge primary_track + backup_track.
      let dimensions = sanitizeAnglesList(
        root.dimensions ?? root.dims_list ?? root.angles,
        asObj(root),
        notes,
        "eastern_dims",
        2,
      );
      if (!dimensions) {
        const primary = sanitizeEastern(
          root.primary_track ?? root.primary ?? root.main,
          "primary",
          notes,
        );
        const backup = sanitizeEastern(
          root.backup_track ?? root.backup ?? root.aux,
          "backup",
          notes,
        );
        const merged: Record<string, unknown>[] = [];
        if (primary && Array.isArray(primary.dimensions)) {
          merged.push(...(primary.dimensions as Record<string, unknown>[]));
        }
        if (backup && Array.isArray(backup.dimensions)) {
          merged.push(...(backup.dimensions as Record<string, unknown>[]));
        }
        if (merged.length < 2) {
          const literalHit = notes.some(
            (n) =>
              n.includes("p4_literal") ||
              n.includes("p4_means_missing") ||
              n.includes("p4_means_order"),
          );
          return {
            ok: false,
            structural: true,
            reason: literalHit ? "p4_literal_wuxing_means" : "eastern_dimensions_lt_2",
            notes,
          };
        }
        dimensions = merged.slice(0, 6);
        notes.push("legacy_primary_backup_tracks_merged");
      }

      const question_anchor = scrubP4UserVisibleProse(
        clip(
          root.question_anchor ?? root.matter ?? root.question ?? root.original_question,
          280,
        ) || "",
      );
      const desired_outcome = scrubP4UserVisibleProse(
        clip(
          root.desired_outcome ?? root.expectation ?? root.want ?? root.goal,
          280,
        ) || "",
      );
      if (!question_anchor || !desired_outcome) {
        return {
          ok: false,
          structural: true,
          reason: "missing_question_or_desired_outcome_anchor",
          notes,
        };
      }

      const matrixRaw = Array.isArray(root.field_matrix) ? root.field_matrix : [];
      if (matrixRaw.length > 0) notes.push("drop_retired_p4_field_matrix");
      const field_matrix: Array<{ label: string; value: string }> = [];
      const dimensionsCompliant = (dimensions as Array<Record<string, unknown>>).map(
        (d) => {
          const prev = typeof d.name === "string" ? d.name : "";
          const next = remapP4DimensionNameForCompliance(prev);
          if (next !== prev) notes.push("p4_dim_name_compliance_remap");
          return { ...d, name: next || prev } as Record<string, unknown>;
        },
      );
      const strategyTexts = dimensionsCompliant.map((d) => {
        const strategy = typeof d.strategy === "string" ? d.strategy : String(d.strategy ?? "");
        const means = Array.isArray(d.means) ? d.means.map(String) : [];
        return [strategy, ...means].join("\n");
      });
      notes.push(
        ...noteP4DestinyGrounding({
          strategies: strategyTexts,
          eastern_calc_slice: opts?.eastern_calc_slice,
        }),
      );
      candidate = {
        page: "metaphysics_action",
        question_anchor,
        desired_outcome,
        dimensions: dimensionsCompliant,
        leverage,
        avoid,
        field_matrix,
        evidence: sanitizeEvidence(root.evidence),
      };
      break;
    }
    case "thirty_day": {
      const weeksRaw = Array.isArray(root.weeks) ? root.weeks : [];
      const weeks = [1, 2, 3, 4].map((w) => {
        const found =
          weeksRaw.find((item) => {
            const o = asObj(item);
            return o && Number(o.week) === w;
          }) ?? weeksRaw[w - 1];
        const o = asObj(found) ?? {};
        const actions = arrClip(o.actions ?? o.steps, 5, 200);
        return {
          week: w as 1 | 2 | 3 | 4,
          focus: clip(o.focus ?? o.theme, 120) || `Week ${w}`,
          actions: actions.length > 0 ? actions : [`Complete week ${w} checkpoint`],
          source_refs: arrClip(o.source_refs ?? o.refs, 6, 40),
        };
      });
      const day7 = arrClip(root.day7_checklist ?? root.checklist ?? root.near_term, 10, 160);
      if (day7.length < 3) {
        return { ok: false, structural: true, reason: "day7_checklist_lt_3", notes };
      }
      candidate = {
        page: "thirty_day",
        weeks,
        day7_checklist: day7,
        evidence: sanitizeEvidence(root.evidence),
      };
      break;
    }
    case "risk_guard": {
      const red_lights = arrRiskItems(root.red_lights ?? root.red_flags, 4, 200);
      const traps = arrRiskItems(root.traps ?? root.pitfalls, 3, 200);
      const protection_rules = arrRiskItems(
        root.protection_rules ?? root.rules ?? root.guards,
        4,
        200,
      );
      const switch_to_backup = coerceSwitchItem(
        root.switch_to_backup ?? root.switch_condition ?? root.backup_switch,
        200,
      );
      if (
        red_lights.length < 2 ||
        traps.length < 1 ||
        protection_rules.length < 2 ||
        !switch_to_backup
      ) {
        return {
          ok: false,
          structural: true,
          reason: "circuit_breakers_incomplete",
          notes,
        };
      }
      if (root.boundary_script ?? root.boundary_reply ?? root.short_script) {
        notes.push("drop_retired_boundary_script");
      }
      const allRisk = [
        ...red_lights,
        ...traps,
        switch_to_backup,
        ...protection_rules,
      ];
      if (allRisk.some((r) => !r.narrative?.trim())) {
        notes.push("risk_items_missing_narrative");
      }
      candidate = {
        page: "risk_guard",
        red_lights,
        traps,
        switch_to_backup,
        protection_rules,
        evidence: sanitizeEvidence(root.evidence),
      };
      break;
    }
    case "signals_close": {
      const identity_before = clip(root.identity_before ?? root.before, 120);
      const identity_after = clip(root.identity_after ?? root.after, 120);
      const identity_shift = clip(
        root.identity_shift ?? root.shift_reason ?? root.why_shift,
        220,
      ) || "这一切换对准本案主路径：从硬扛一线，转到守决策、放执行。";
      const quote = clip(root.quote ?? root.verse ?? root.gold, 120);
      const quote_use = clip(
        root.quote_use ?? root.quote_how ?? root.when_wobble,
        160,
      ) || "摇摆想退回旧角色时，默念这句，再看今晚那一件事。";
      const immediate_action = clip(
        root.immediate_action ?? root.tonight ?? root.one_thing,
        160,
      );
      const tonight_done_looks_like = clip(
        root.tonight_done_looks_like ?? root.done_looks_like ?? root.tonight_done,
        160,
      ) || "写完可出示的半页草稿（或等价产出），不是只在脑子里过一遍。";
      const tonight_why = clip(
        root.tonight_why ?? root.why_tonight,
        160,
      ) || "拖过今晚，摇摆会把你拉回一线硬扛的旧惯性。";
      const day7_micro_actions = arrDay7Items(
        root.day7_micro_actions ??
          root.day7_checklist ??
          root.near_term ??
          root.micro_actions,
        5,
      );
      let takeaways = coerceTakeaways(root.takeaways ?? root.carry_seal ?? root.seal);
      if (!takeaways && identity_before && identity_after && immediate_action) {
        takeaways = [
          clip(`主路：${identity_after}`, 80) || "守住决策，授权执行。",
          clip(`近阶：${day7_micro_actions[0]?.action ?? immediate_action}`, 80) ||
            "本周只推进可勾选近阶。",
          "红灯亮了就切辅，不硬扛。",
        ];
      }
      if (!identity_before || !identity_after || !quote || !immediate_action) {
        return { ok: false, structural: true, reason: "identity_close_incomplete", notes };
      }
      if (day7_micro_actions.length < 4) {
        return { ok: false, structural: true, reason: "day7_micro_actions_lt_4", notes };
      }
      if (!takeaways) {
        return { ok: false, structural: true, reason: "takeaways_incomplete", notes };
      }
      candidate = {
        page: "signals_close",
        identity_before,
        identity_after,
        identity_shift,
        quote,
        quote_use,
        immediate_action,
        tonight_done_looks_like,
        tonight_why,
        day7_micro_actions,
        takeaways,
        evidence: sanitizeEvidence(root.evidence),
      };
      break;
    }
    default:
      return { ok: false, structural: true, reason: `unknown_key_${key}`, notes };
  }

  attachPageChrome(key, root, candidate);
  if (key === "metaphysics_action") {
    const t0 = String(candidate.page_title ?? "");
    const s0 = String(candidate.page_subtitle ?? "");
    const t1 = scrubP4UserVisibleProse(t0);
    const s1 = scrubP4UserVisibleProse(s0);
    if (t1 !== t0 || s1 !== s0) notes.push("p4_chrome_gateway_scrub");
    candidate.page_title = t1 || t0;
    candidate.page_subtitle = s1;
  }

  // P0-4 · 单元 chart_anchors 质量闸（全空 → structural；部分空 → notes）
  {
    const units = collectPageAnchorUnits(key, candidate);
    const aq = assessUnitAnchorQuality({ pageKey: key, units });
    notes.push(...aq.notes);
    if (aq.structuralFail) {
      return {
        ok: false,
        structural: true,
        reason: aq.reason ?? "all_content_units_missing_chart_anchors",
        notes,
      };
    }
  }

  const schema = DeliveryPageSchemaByKey[key as keyof typeof DeliveryPageSchemaByKey];
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      structural: true,
      reason: `zod_${parsed.error.issues[0]?.path?.join(".") ?? "fail"}`,
      notes: [...notes, ...parsed.error.issues.map((i) => i.message)],
    };
  }
  return {
    ok: true,
    page: parsed.data as DeliveryPageData,
    truncated,
    notes,
  };
}

/** True when fill should LLM-retry (structure only). */
export function isStructuralSanitizeFailure(r: SanitizeResult): boolean {
  return !r.ok && r.structural === true;
}
