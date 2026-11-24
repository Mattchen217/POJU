/**
 * Page06 prompt templates — callable from production (not docs-only).
 */

import {
  PAGE06_SECTION_DEFINITIONS,
  type Page06SectionId,
} from "./sections";
import { page06ContentSpecForSection } from "./content-specs";
import { PAGE06_MODEL_TASKS } from "./tasks";
import type { Page06InputManifestEntry } from "./input-contracts";
import type { Page06MissingInput } from "./gaps";
import {
  PAGE06_DOWNSTREAM_CONTRACT,
  PAGE06_UPSTREAM_CONTRACT,
} from "./dependency-contracts";

export const PAGE06_ARCHITECTURE_PROMPT_VERSION =
  "page06-arch-prompt-2026-11-23" as const;

export function buildPage06SectionPromptBlock(
  sectionId: Page06SectionId,
): string {
  const section = PAGE06_SECTION_DEFINITIONS.find(
    (s) => s.section_id === sectionId,
  );
  const spec = page06ContentSpecForSection(sectionId);
  if (!section || !spec) return "";
  return [
    `### Section ${section.segment_letter} · ${section.section_id}`,
    `title: ${section.title_zh} / ${section.title_en}`,
    `purpose: ${spec.purpose}`,
    `user_should_understand: ${spec.user_should_understand}`,
    `boundary: ${spec.content_boundary}`,
    `style: ${spec.language_style}`,
    `length: ${spec.length_guidance}`,
    `allowed_kinds: ${spec.allowed_unit_kinds.join(", ")}`,
    `must_include: ${spec.must_include.join(" · ")}`,
    `must_not: ${spec.must_not_include.join(" · ")}`,
    `empty_display: ${section.empty_display_zh}`,
  ].join("\n");
}

export function buildPage06ArchitecturePromptBundle(input: {
  input_manifest: readonly Page06InputManifestEntry[];
  missing_inputs: readonly Page06MissingInput[];
  generation_status: string;
}): string {
  const task = PAGE06_MODEL_TASKS[0]!;
  const sectionBlocks = PAGE06_SECTION_DEFINITIONS.map((s) =>
    buildPage06SectionPromptBlock(s.section_id),
  ).join("\n\n");

  const manifestLines = input.input_manifest.map(
    (m) =>
      `- ${m.field_id} · section=${m.section_id} · present=${m.present} · status=${m.collection_status} · ${m.value_summary ?? "—"}`,
  );
  const gapLines = input.missing_inputs.map(
    (g) =>
      `- ${g.gap_id} · ${g.status} · field=${g.field_id} · section=${g.section_id} · handling=${g.handling} · affects=${g.affects_content}`,
  );

  return [
    `## Page06 Architecture Prompt Bundle (v=${PAGE06_ARCHITECTURE_PROMPT_VERSION})`,
    `task_id: ${task.task_id}`,
    `generation_status: ${input.generation_status}`,
    "",
    "### Page duty",
    "Page06 = Strategy Execution & Validation only (策略执行与验证).",
    "Turn Page05 paths into a first step, ordered actions, optional experiments, personal adjustments, rhythm, and resource/monitoring boundaries.",
    "Do NOT substitute Page01/02/04/05/07/08.",
    "",
    "### Upstream (read-only; execute, do not re-rank)",
    `Page05: ${PAGE06_UPSTREAM_CONTRACT.page05.join("; ")}`,
    `Page01: ${PAGE06_UPSTREAM_CONTRACT.page01.join("; ")}`,
    `Page02: ${PAGE06_UPSTREAM_CONTRACT.page02.join("; ")}`,
    `Page04: ${PAGE06_UPSTREAM_CONTRACT.page04.join("; ")}`,
    "",
    "### Downstream output stability (active Page08 consumer)",
    `status: ${PAGE06_DOWNSTREAM_CONTRACT.page08.status}`,
    `implemented: ${PAGE06_DOWNSTREAM_CONTRACT.page08.implemented}`,
    `Page08 consumes: ${PAGE06_DOWNSTREAM_CONTRACT.page08.fields.join("; ")}`,
    PAGE06_DOWNSTREAM_CONTRACT.page08.note,
    "",
    "### Task purpose",
    task.purpose,
    "",
    "### Hard bans (task)",
    ...task.bans.map((b) => `- ${b}`),
    "",
    "### Gap rules (mandatory)",
    "- Do NOT invent user reality facts to fill missing/unknown/declined gaps.",
    "- Do NOT upgrade unverified/unknown/declined/conflict into confirmed.",
    "- Do NOT invent path_ids. primary_path_id must be a Page05 preferred path; fallback_path_ids must be Page05 alternatives.",
    "- Do NOT invent validation experiments to pad counts; use experiments_absent_note when none.",
    "- Do NOT invent scores, success %, or unsourced numeric rankings.",
    "- Personal adjustments must cite existing personal unit refs and/or reality fact ids.",
    "- If handling=defer_generation: the program should not have called you.",
    "- Do NOT mint claim/evidence associations the program did not certify.",
    "- Do NOT invent Schema fields outside Face06V2.",
    "",
    "### Input manifest (program-assembled; read-only)",
    ...manifestLines,
    "",
    "### missing_inputs (program-assembled; read-only)",
    ...(gapLines.length ? gapLines : ["- (none)"]),
    "",
    "### Section content specs",
    sectionBlocks,
  ].join("\n");
}
