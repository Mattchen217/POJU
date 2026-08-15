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
  const core_logic = clip(
    o.core_logic ?? o.logic ?? o.approach ?? o.deep_why ?? o.playbook ?? o.summary,
    720,
  );
  if (!core_logic) {
    notes.push(`${role}_missing_core_logic`);
    return null;
  }
  const why = clip(o.why ?? o.reason ?? o.rationale, 240) || "—";
  return {
    role: mapRole(o.role, role),
    name: clip(o.name ?? o.title ?? o.label, 80) || (role === "primary" ? "Primary path" : "Backup path"),
    core_logic,
    why,
    when: clip(o.when ?? o.condition ?? o.if, 240) || "—",
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
  const means = arrClip(
    o.means ?? o.steps ?? o.methods ?? o.actions,
    6,
    240,
  );
  if (means.length === 0) {
    notes.push(`${tag}_no_means`);
    return null;
  }
  return {
    name: clip(o.name ?? o.title ?? o.label, 80) || tag,
    strategy: clip(o.strategy ?? o.approach ?? o.why, 560) || "—",
    means,
    exact_script: clipOpt(o.exact_script ?? o.script ?? o.opening_line, 160),
    hard_metrics: arrClip(o.hard_metrics ?? o.metrics ?? o.kpis, 4, 160),
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

/** Attach dynamic page chrome; fallback title = fixed tag (zh). */
function attachPageChrome(
  key: DeliverySegmentKey,
  root: Record<string, unknown>,
  candidate: Record<string, unknown>,
): void {
  const fallback = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  const title =
    clip(root.page_title ?? root.headline ?? root.main_title, 56) || fallback;
  const subtitle = clip(root.page_subtitle ?? root.subtitle ?? root.subhead, 80);
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
      const dashboard = dashRaw.slice(0, 8).map((item, i) => {
        const o = asObj(item) ?? {};
        return {
          key: clip(o.key ?? `m${i}`, 40) || `m${i}`,
          label: clip(o.label ?? o.name ?? o.key, 60) || `Metric ${i + 1}`,
          score: numOrNull(o.score ?? o.value),
          note: clipOpt(o.note, 160),
        };
      });
      if (dashboard.length === 0) {
        return { ok: false, structural: true, reason: "empty_dashboard", notes };
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
        return { title, surface, essence };
      });

      // Legacy: page-level pair + body-only cards → multi-surface cards
      const missingSurfaces = why_cards.filter((c) => !c.surface).length;
      if (missingSurfaces > 0 && pageSurface && pageEssence) {
        notes.push("legacy_multi_surface_from_page_pair");
        if (why_cards.length === 0) {
          why_cards = [{ title: "总对照", surface: pageSurface, essence: pageEssence }];
        } else {
          why_cards = why_cards.map((c, i) => ({
            title: c.title,
            surface:
              c.surface ||
              (i === 0 ? pageSurface : clip(`${c.title}: ${pageSurface}`, 280)) ||
              pageSurface,
            essence: c.essence || (i === 0 ? pageEssence : c.essence) || pageEssence,
          }));
          // Prefer promoting page pair as its own first card when first card had no surface
          const firstRaw = asObj(whySrc[0]) ?? {};
          if (!clip(firstRaw.surface, 280) && why_cards[0]) {
            why_cards = [
              { title: "总对照", surface: pageSurface, essence: pageEssence },
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
      if (why_cards.length < 2) {
        return { ok: false, structural: true, reason: "why_cards_lt_2", notes };
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
        opening: clipOpt(root.opening ?? root.intro, 200),
        primary_toolkit,
        backup_toolkit,
        alert: clipOpt(root.alert ?? root.warning, 240),
        evidence: sanitizeEvidence(root.evidence),
      };
      break;
    }
    case "metaphysics_action": {
      const leverage = arrClip(root.leverage ?? root.borrow, 5, 200);
      const avoid = arrClip(root.avoid ?? root.pitfalls, 5, 200);
      if (leverage.length === 0 || avoid.length === 0) {
        return { ok: false, structural: true, reason: "missing_leverage_or_avoid", notes };
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
          return {
            ok: false,
            structural: true,
            reason: "eastern_dimensions_lt_2",
            notes,
          };
        }
        dimensions = merged.slice(0, 6);
        notes.push("legacy_primary_backup_tracks_merged");
      }

      const question_anchor = clip(
        root.question_anchor ?? root.matter ?? root.question ?? root.original_question,
        280,
      );
      const desired_outcome = clip(
        root.desired_outcome ?? root.expectation ?? root.want ?? root.goal,
        280,
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
      const field_matrix = matrixRaw.slice(0, 4).map((item) => {
        const o = asObj(item) ?? {};
        return {
          label: clip(o.label ?? o.key, 40) || "—",
          value: clip(o.value ?? o.text, 120) || "—",
        };
      });
      candidate = {
        page: "metaphysics_action",
        question_anchor,
        desired_outcome,
        dimensions,
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
      const red_lights = arrClip(root.red_lights ?? root.red_flags, 6, 200);
      const traps = arrClip(root.traps ?? root.pitfalls, 5, 200);
      const protection_rules = arrClip(
        root.protection_rules ?? root.rules ?? root.guards,
        6,
        200,
      );
      const switch_to_backup = clip(
        root.switch_to_backup ?? root.switch_condition ?? root.backup_switch,
        320,
      );
      const boundary_script = clipOpt(
        root.boundary_script ?? root.boundary_reply ?? root.short_script,
        120,
      );
      if (red_lights.length < 2 || traps.length < 1 || protection_rules.length < 2 || !switch_to_backup) {
        return {
          ok: false,
          structural: true,
          reason: "circuit_breakers_incomplete",
          notes,
        };
      }
      candidate = {
        page: "risk_guard",
        red_lights,
        traps,
        switch_to_backup,
        protection_rules,
        ...(boundary_script ? { boundary_script } : {}),
        evidence: sanitizeEvidence(root.evidence),
      };
      break;
    }
    case "signals_close": {
      const identity_before = clip(root.identity_before ?? root.before, 160);
      const identity_after = clip(root.identity_after ?? root.after, 160);
      const quote = clip(root.quote ?? root.verse ?? root.gold, 200);
      const immediate_action = clip(
        root.immediate_action ?? root.tonight ?? root.one_thing,
        200,
      );
      const day7_micro_actions = arrClip(
        root.day7_micro_actions ??
          root.day7_checklist ??
          root.near_term ??
          root.micro_actions,
        5,
        160,
      );
      if (!identity_before || !identity_after || !quote || !immediate_action) {
        return { ok: false, structural: true, reason: "identity_close_incomplete", notes };
      }
      if (day7_micro_actions.length < 3) {
        return { ok: false, structural: true, reason: "day7_micro_actions_lt_3", notes };
      }
      candidate = {
        page: "signals_close",
        identity_before,
        identity_after,
        quote,
        immediate_action,
        day7_micro_actions,
        evidence: sanitizeEvidence(root.evidence),
      };
      break;
    }
    default:
      return { ok: false, structural: true, reason: `unknown_key_${key}`, notes };
  }

  attachPageChrome(key, root, candidate);

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
