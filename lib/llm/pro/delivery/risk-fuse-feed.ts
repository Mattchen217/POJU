/**
 * P5 risk_guard · fuse candidate menu from ActionBrief × polarity × collecting.
 * Quality-first: give the model real brakes to write — do not rely on
 * circuit_breakers_incomplete retries to invent generic red lights.
 *
 * Also seeds Assign binding tuples per fuse path.
 */

import type { BreakthroughCore } from "@/lib/poju/agent-state";
import type { CoveredAgendaItem } from "./reality-constraints";
import type { P5ActionBrief } from "./page-schema/types";
import { splitSelfCheckSignals } from "./page-plan/self-check-split";
import {
  clipAssignField,
  formatAssignBindingHintTable,
  type AssignPathHint,
} from "./page-schema/assign-binding-seed";
import { fiveElementToZh } from "@/lib/llm/pro/delivery/locale-evidence-tokens";

function clip(s: string, max: number): string {
  return clipAssignField(s, max);
}

function pushUnique(out: string[], line: string, max: number): void {
  const t = line.trim();
  if (!t || out.length >= max) return;
  const norm = t.replace(/\s+/g, "").slice(0, 48);
  if (out.some((x) => x.replace(/\s+/g, "").slice(0, 48) === norm)) return;
  out.push(t);
}

const RISK_POLARITY_RE =
  /压力|易栽|未熟|过耗|过刚|压制|阻力|忌|盲|耗|崩|风险|熔断|红灯|坑|警戒|不宜|硬冲|耗尽|失控|失眠|血压|催促|加塞|英雄/;

export const RISK_ASSIGN_PATHS = [
  "red_lights[0]",
  "red_lights[1]",
  "traps[0]",
  "switch_to_backup",
  "protection_rules[0]",
  "protection_rules[1]",
] as const;

export type RiskFuseFeedOpts = {
  original_question?: string | null;
  desired_outcome?: string | null;
  primary_backup_hint?: string | null;
  answerMaxChars?: number;
};

function collectExecFaces(
  brief: P5ActionBrief | null | undefined,
  answerMax: number,
): string[] {
  if (!brief) return [];
  const execFaces: string[] = [];
  for (const s of brief.p3_primary_steps.slice(0, 6)) {
    pushUnique(execFaces, `P3主 · ${clip(s, answerMax)}`, 8);
  }
  for (const s of brief.p3_backup_steps.slice(0, 4)) {
    pushUnique(execFaces, `P3辅 · ${clip(s, answerMax)}`, 8);
  }
  for (const s of brief.p4_primary_means.slice(0, 6)) {
    pushUnique(execFaces, `P4 · ${clip(s, answerMax)}`, 8);
  }
  for (const s of brief.p4_avoid.slice(0, 4)) {
    pushUnique(execFaces, `P4避开 · ${clip(s, answerMax)}`, 8);
  }
  return execFaces;
}

export function buildRiskAssignPathHints(
  core: BreakthroughCore | null | undefined,
  brief: P5ActionBrief | null | undefined,
  execFaces: readonly string[],
): AssignPathHint[] {
  const anchors = [...(brief?.source_anchors ?? [])];
  for (const d of core?.multi_dimension_reckoning ?? []) {
    for (const t of (d.chart_basis ?? "").split(/[、,，;/|]+/)) {
      const x = t.trim();
      if (x.length >= 2 && x.length <= 24) anchors.push(x);
    }
  }
  const used = new Set<string>();
  const takePrimary = (): string | undefined => {
    for (const a of anchors) {
      const n = a.trim().toLowerCase();
      if (!n || used.has(n)) continue;
      used.add(n);
      return a.trim();
    }
    return undefined;
  };

  const { negative } = splitSelfCheckSignals(core?.self_check_signals ?? []);
  const blind = core?.key_crossroads?.decision_traits?.trim() || "";
  const costs = core?.key_crossroads?.path_costs?.trim() || "";
  const avoid = brief?.p4_avoid?.[0] ?? "";
  /** Destination = P1 backup **name**; when only for cite timing (#14). */
  const backupName = brief?.backup_name?.trim() || "";
  const backupWhen = brief?.backup_when?.trim() || "";
  const primaryName = brief?.primary_name?.trim() || "";
  const switchDest = backupName || "辅轨";
  const primaryWhen = brief?.primary_when?.trim() || "";
  const ji =
    core?.metaphysics_pack?.yong_shen.ji_shen
      ?.map((s) => fiveElementToZh(s))
      .filter(Boolean)
      .join("、") ?? "";

  /**
   * Never seed bare「主手段」(3 chars). Brief 空时按槽分化 FALLBACK cite，
   * 禁止 6 槽共用同一句「推进本案主路径…」→ Lab mark 派工腔墙.
   */
  const FALLBACK_CITES = [
    "推进本案主路径执行动作时，结构过耗或失控须立即停",
    "主路径节奏失控、开口无效时，须熔断当前动作",
    "执行中出现假进展或盲区扩写时，须停步核对结构承重",
    "主路径代价超过可承受边界时，须评估停主切辅",
    "避开持续掏空根基的过耗动作，守住回血窗口",
    "守住身体与精力可承受硬边界，过线即停",
  ] as const;
  const face = (i: number) =>
    execFaces[i] ?? execFaces[0] ?? FALLBACK_CITES[i % FALLBACK_CITES.length]!;
  const richCite = (slotIdx: number, ...parts: Array<string | undefined>) => {
    for (const p of parts) {
      const t = (p ?? "").trim();
      if (t.length >= 12) return clip(t, 80);
    }
    return clip(FALLBACK_CITES[slotIdx % FALLBACK_CITES.length]!, 80);
  };
  const specs: Array<{
    path: (typeof RISK_ASSIGN_PATHS)[number];
    ref: string;
    cite: string;
    claim: string;
  }> = [
    {
      path: "red_lights[0]",
      ref: execFaces[0] ? "执行面1" : "熔断候选1",
      cite: richCite(0, negative[0], face(0), primaryWhen, ji && `忌神${ji}过旺为红灯`),
      claim: clip(`做「${clip(face(0), 40)}」若出现红灯须立即停`, 120),
    },
    {
      path: "red_lights[1]",
      ref: execFaces[1] ? "执行面2" : "熔断候选2",
      cite: richCite(1, negative[1], face(1), primaryWhen),
      claim: clip(`做「${clip(face(1), 40)}」若过耗/失控须熔断`, 120),
    },
    {
      path: "traps[0]",
      ref: "结构坑",
      cite: richCite(2, blind, face(2)),
      claim: clip(`执行中易踩的假进展/盲区：${clip(blind || face(2), 40)}`, 120),
    },
    {
      path: "switch_to_backup",
      ref: "切辅条件",
      cite: richCite(
        3,
        costs,
        backupWhen
          ? `切到「${switchDest}」的时机：${backupWhen}；条件与代价`
          : `切到「${switchDest}」的条件与代价` +
              (primaryName ? `（≠主「${primaryName}」）` : ""),
      ),
      claim: clip(`停主切辅条件：转向「${switchDest}」`, 120),
    },
    {
      path: "protection_rules[0]",
      ref: avoid ? "执行面·P4避开" : "防护1",
      cite: richCite(4, avoid, face(3), ji && `护栏隔离忌神${ji}`),
      claim: clip(`护栏：避开「${clip(avoid || face(3), 40)}」`, 120),
    },
    {
      path: "protection_rules[1]",
      ref: "防护2",
      cite: richCite(5, negative[2], face(4), "守住身体与精力可承受硬边界"),
      claim: clip(`第二条护栏：守住本案可承受边界`, 120),
    },
  ];

  return specs.map((s) => ({
    path: s.path,
    prefer_primary: takePrimary(),
    prefer_candidate_ref: s.ref,
    prefer_cite: s.cite,
    prefer_claim: s.claim,
  }));
}

/**
 * Numbered fuse menu for deep + fill (risk_guard). Keep on compress.
 */
export function buildRiskFuseFeedBlock(
  core: BreakthroughCore | null | undefined,
  brief: P5ActionBrief | null | undefined,
  covered_agenda: readonly CoveredAgendaItem[] | null | undefined,
  opts?: RiskFuseFeedOpts,
): string {
  const answerMax = opts?.answerMaxChars ?? 160;
  const lines: string[] = [
    "【P5 熔断候选菜单 · RiskItem 优先生长源】",
    "规则：6 条钉死 = red_lights[0..1] + traps[0] + switch_to_backup + protection_rules[0..1]。",
    "每条 narrative 须指回下列某一「执行面」手段（做 X 时若出现 Y…）；删 chart_anchors 后处置链须垮。",
    "禁另立与 Brief 脱节的行动课；禁编造议程未确认的时限 KPI；禁写成 P6 出门仪式。",
  ];

  const q = opts?.original_question?.trim();
  if (q) lines.push(`问题: ${clip(q, answerMax)}`);
  const want = opts?.desired_outcome?.trim();
  if (want) lines.push(`期望: ${clip(want, answerMax)}`);
  const hint = opts?.primary_backup_hint?.trim();
  if (hint) lines.push(`主辅对照:\n${clip(hint, 320)}`);

  const execFaces = collectExecFaces(brief, answerMax);
  if (brief) {
    lines.push(
      `Brief 主辅: ${brief.primary_name || "(缺)"} | when=${brief.primary_when || "—"} ‖ 辅=${brief.backup_name || "(缺)"} | when=${brief.backup_when || "—"}`,
      `切辅钉名: 目标=「${brief.backup_name || "辅轨"}」≠主「${brief.primary_name || "主轨"}」；switch_to_backup 禁把主名写成辅轨/辅路`,
    );
    if (execFaces.length > 0) {
      lines.push("执行面(手段 — narrative 须点名其一):");
      execFaces.forEach((f, i) => lines.push(`执行面${i + 1}. ${f}`));
    } else {
      lines.push(
        "执行面: (Brief 手段偏空 — 用主辅 when + 极性/path_costs 写刹车；仍禁另立第三套药方)",
      );
    }
    if (brief.source_anchors.length) {
      lines.push(
        `优先 chart_anchors: ${brief.source_anchors.slice(0, 12).join("、")}`,
      );
    }
  } else {
    lines.push("Brief: (未就绪 — 仅用极性+主辅 hint；P4 手段可后补)");
  }

  const pack = core?.metaphysics_pack;
  const ji = pack?.yong_shen.ji_shen?.map((s) => fiveElementToZh(s)).filter(Boolean) ?? [];
  if (ji.length) lines.push(`忌神: ${ji.join("、")}`);
  const dash = pack?.dashboard;
  if (dash) {
    lines.push(
      `dashboard 极性: resistance=${dash.resistance_load} sustain=${dash.sustain_capacity} output=${dash.output_capacity}`,
    );
  }

  const xc = core?.key_crossroads;
  if (xc?.decision_traits?.trim()) {
    lines.push(`blind_spots / decision_traits:\n${clip(xc.decision_traits, 220)}`);
  }
  if (xc?.path_costs?.trim()) {
    lines.push(`path_costs:\n${clip(xc.path_costs, 220)}`);
  }

  const { negative } = splitSelfCheckSignals(core?.self_check_signals ?? []);
  if (negative.length) {
    lines.push("self_check(负向):");
    for (const s of negative.slice(0, 5)) lines.push(`- ${clip(s, 120)}`);
  }

  const dims = (core?.multi_dimension_reckoning ?? []).filter((d) =>
    RISK_POLARITY_RE.test(`${d.dimension}${d.judgment}${d.chart_basis}`),
  );
  const riskDims =
    dims.length > 0 ? dims.slice(0, 5) : (core?.multi_dimension_reckoning ?? []).slice(0, 3);
  if (riskDims.length > 0) {
    lines.push("风险极性多维:");
    for (const d of riskDims) {
      lines.push(
        `- 【${clip(d.dimension, 32)}】${clip(d.judgment, 100)}（锚: ${clip(d.chart_basis, 48)}）`,
      );
    }
  }

  const facts: string[] = [];
  for (const item of covered_agenda ?? []) {
    const label = clip(item.label || "项", 40);
    const answer = item.answer?.trim();
    if (answer) pushUnique(facts, `${label}: ${clip(answer, answerMax)}`, 5);
  }
  if (facts.length) {
    lines.push("收集事实(时限/KPI 只许同向):");
    facts.forEach((f, i) => lines.push(`事实${i + 1}. ${f}`));
  }

  lines.push(
    "建议槽位映射:",
    "- red_lights[0..1] ← 执行面主手段 + 忌神/负向多维红灯",
    "- traps[0] ← 结构特有坑(decision_traits/blind) 在执行某手段时触发",
    "- switch_to_backup ← Brief 辅 when + path_costs；写清停主切辅条件",
    "- protection_rules[0..1] ← P4避开/忌神防护 + 身体自述红线",
  );

  const hintTable = formatAssignBindingHintTable(
    buildRiskAssignPathHints(core, brief, execFaces),
  );
  if (hintTable) lines.push(hintTable);

  return lines.join("\n");
}
