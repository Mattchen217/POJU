/**
 * Page02 prompt templates — callable from production (not docs-only).
 */

import {
  PAGE02_SECTION_DEFINITIONS,
  type Page02SectionId,
} from "./sections";
import { page02ContentSpecForSection } from "./content-specs";
import { PAGE02_MODEL_TASKS } from "./tasks";
import type { Page02InputManifestEntry } from "./input-contracts";
import type { Page02MissingInput } from "./gaps";

export const PAGE02_ARCHITECTURE_PROMPT_VERSION =
  "page02-arch-prompt-2026-11-23" as const;

/** Per-section prompt fragment — assembled into the live Face02 task prompt. */
export function buildPage02SectionPromptBlock(
  sectionId: Page02SectionId,
): string {
  const section = PAGE02_SECTION_DEFINITIONS.find(
    (s) => s.section_id === sectionId,
  );
  const spec = page02ContentSpecForSection(sectionId);
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

export function buildPage02ArchitecturePromptBundle(input: {
  input_manifest: readonly Page02InputManifestEntry[];
  missing_inputs: readonly Page02MissingInput[];
  generation_status: string;
}): string {
  const task = PAGE02_MODEL_TASKS[0]!;
  const sectionBlocks = PAGE02_SECTION_DEFINITIONS.map((s) =>
    buildPage02SectionPromptBlock(s.section_id),
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
    `## Page02 Architecture Prompt Bundle (v=${PAGE02_ARCHITECTURE_PROMPT_VERSION})`,
    `task_id: ${task.task_id}`,
    `generation_status: ${input.generation_status}`,
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
    "- If handling=omit_section_content: leave that section's unit list empty or use conditional language only.",
    "- If handling=defer_generation: the program should not have called you; if called, emit only boundary gap notes.",
    "- If handling=generate_conditional_only: use conditional_explanation; never claim confirmed.",
    "- If handling=show_gap_note_only: put the gap into explanation_boundary.uncertainty_notes.",
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
