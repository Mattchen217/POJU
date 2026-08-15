/**
 * Pure-code Action Extractor (Wave B → C).
 * Never dump full P2–P4 JSON into P5/P6 prompts.
 */

import type {
  ActionAngle,
  P1Page,
  P3Page,
  P4Page,
  P5ActionBrief,
  P5Page,
  P5WeekSummary,
} from "./types";
import { P5ActionBriefSchema, P5WeekSummarySchema } from "./types";

function flatMeans(angles: ActionAngle[] | undefined, max: number): string[] {
  if (!angles?.length) return [];
  const out: string[] = [];
  for (const a of angles) {
    for (const m of a.means) {
      out.push(m);
      if (out.length >= max) return out;
    }
  }
  return out;
}

function flatMetrics(angles: ActionAngle[] | undefined, max: number): string[] {
  if (!angles?.length) return [];
  const out: string[] = [];
  for (const a of angles) {
    for (const m of a.hard_metrics ?? []) {
      out.push(m);
      if (out.length >= max) return out;
    }
  }
  return out;
}

function firstScript(angles: ActionAngle[] | undefined): string | undefined {
  if (!angles?.length) return undefined;
  for (const a of angles) {
    const s = a.exact_script?.trim();
    if (s) return s;
  }
  return undefined;
}

export function extractP5ActionBrief(input: {
  p1?: P1Page | null;
  p3?: P3Page | null;
  p4?: P4Page | null;
}): P5ActionBrief {
  const { p1, p3, p4 } = input;
  const raw = {
    primary_name: p1?.primary.name ?? "Primary path",
    backup_name: p1?.backup.name ?? "Backup path",
    primary_when: p1?.primary.when ?? "",
    backup_when: p1?.backup.when ?? "",
    p3_primary_script: firstScript(p3?.primary_toolkit.angles),
    p3_primary_steps: flatMeans(p3?.primary_toolkit.angles, 12),
    p3_backup_steps: flatMeans(p3?.backup_toolkit.angles, 12),
    p3_hard_metrics: [
      ...flatMetrics(p3?.primary_toolkit.angles, 4),
      ...flatMetrics(p3?.backup_toolkit.angles, 4),
    ].slice(0, 8),
    p4_leverage: p4?.leverage ?? [],
    p4_avoid: p4?.avoid ?? [],
    p4_field_matrix: p4?.field_matrix ?? [],
    p4_primary_means: flatMeans(p4?.dimensions, 12),
    p4_backup_means: [],
  };
  return P5ActionBriefSchema.parse(raw);
}

export function extractP5WeekSummary(p5?: P5Page | null): P5WeekSummary {
  if (!p5) return P5WeekSummarySchema.parse({});
  return P5WeekSummarySchema.parse({
    weeks: p5.weeks.map((w) => ({
      week: w.week,
      focus: w.focus,
      action_count: w.actions.length,
    })),
    day7_head: p5.day7_checklist.slice(0, 5),
  });
}

/** Compact text block for LLM user prompt (not full JSON dump). */
export function formatP5ActionBriefForPrompt(brief: P5ActionBrief): string {
  const lines: string[] = [
    "## P5ActionBrief (code-extracted — sole upstream body for this page)",
    `Primary: ${brief.primary_name} | when: ${brief.primary_when || "—"}`,
    `Backup: ${brief.backup_name} | when: ${brief.backup_when || "—"}`,
  ];
  if (brief.p3_primary_script) {
    lines.push(`P3 primary exact_script: ${brief.p3_primary_script}`);
  }
  if (brief.p3_primary_steps.length) {
    lines.push("P3 primary means (flattened angles):");
    for (const s of brief.p3_primary_steps) lines.push(`- ${s}`);
  }
  if (brief.p3_backup_steps.length) {
    lines.push("P3 backup means (flattened angles):");
    for (const s of brief.p3_backup_steps) lines.push(`- ${s}`);
  }
  if (brief.p3_hard_metrics.length) {
    lines.push("Hard metrics:");
    for (const m of brief.p3_hard_metrics) lines.push(`- ${m}`);
  }
  if (brief.p4_primary_means.length) {
    lines.push("P4 eastern means (question-anchored dims):");
    for (const x of brief.p4_primary_means) lines.push(`- ${x}`);
  }
  if (brief.p4_backup_means.length) {
    lines.push("P4 backup means:");
    for (const x of brief.p4_backup_means) lines.push(`- ${x}`);
  }
  if (brief.p4_leverage.length) {
    lines.push("P4 leverage:");
    for (const x of brief.p4_leverage) lines.push(`- ${x}`);
  }
  if (brief.p4_avoid.length) {
    lines.push("P4 avoid:");
    for (const x of brief.p4_avoid) lines.push(`- ${x}`);
  }
  if (brief.p4_field_matrix.length) {
    lines.push("P4 field_matrix:");
    for (const c of brief.p4_field_matrix) lines.push(`- ${c.label}: ${c.value}`);
  }
  lines.push(
    "",
    "Do NOT invent new primary/backup names. Trace every near-term action to means/metrics above.",
  );
  return lines.join("\n");
}

export function formatP5WeekSummaryForPrompt(summary: P5WeekSummary): string {
  const lines: string[] = ["## P5 week summary (for P6 only; thirty_day retired)"];
  for (const w of summary.weeks) {
    lines.push(`Week ${w.week}: ${w.focus} (${w.action_count} actions)`);
  }
  if (summary.day7_head.length) {
    lines.push("Near-7 checklist head:");
    for (const x of summary.day7_head) lines.push(`- ${x}`);
  }
  return lines.join("\n");
}
