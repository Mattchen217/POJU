/**
 * Pure-code Action Extractor (Wave B → C).
 * Never dump full P2–P4 JSON into P5/P6/P7 prompts.
 */

import type { P1Page, P3Page, P4Page, P5ActionBrief, P5Page, P5WeekSummary } from "./types";
import { P5ActionBriefSchema, P5WeekSummarySchema } from "./types";

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
    p3_primary_script: p3?.primary_toolkit.exact_script,
    p3_primary_steps: p3?.primary_toolkit.steps ?? [],
    p3_backup_steps: p3?.backup_toolkit.steps ?? [],
    p3_hard_metrics: [
      ...(p3?.primary_toolkit.hard_metrics ?? []),
      ...(p3?.backup_toolkit.hard_metrics ?? []),
    ].slice(0, 6),
    p4_leverage: p4?.leverage ?? [],
    p4_avoid: p4?.avoid ?? [],
    p4_field_matrix: p4?.field_matrix ?? [],
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
    lines.push("P3 primary steps:");
    for (const s of brief.p3_primary_steps) lines.push(`- ${s}`);
  }
  if (brief.p3_backup_steps.length) {
    lines.push("P3 backup steps:");
    for (const s of brief.p3_backup_steps) lines.push(`- ${s}`);
  }
  if (brief.p3_hard_metrics.length) {
    lines.push("Hard metrics:");
    for (const m of brief.p3_hard_metrics) lines.push(`- ${m}`);
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
    "Do NOT invent new primary/backup names. Trace every week action to steps/metrics above.",
  );
  return lines.join("\n");
}

export function formatP5WeekSummaryForPrompt(summary: P5WeekSummary): string {
  const lines: string[] = ["## P5 week summary (for P6/P7 only)"];
  for (const w of summary.weeks) {
    lines.push(`Week ${w.week}: ${w.focus} (${w.action_count} actions)`);
  }
  if (summary.day7_head.length) {
    lines.push("Near-7 checklist head:");
    for (const x of summary.day7_head) lines.push(`- ${x}`);
  }
  return lines.join("\n");
}
