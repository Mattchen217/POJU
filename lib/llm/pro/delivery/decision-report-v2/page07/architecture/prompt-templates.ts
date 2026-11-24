/**
 * Page07 prompt templates — callable from production (not docs-only).
 */

import { PAGE07_SECTION_DEFINITIONS, type Page07SectionId } from "./sections";
import { page07ContentSpecForSection } from "./content-specs";
import { PAGE07_MODEL_TASKS } from "./tasks";
import type { Page07InputManifestEntry } from "./input-contracts";
import type { Page07MissingInput } from "./gaps";
import {
  PAGE07_DOWNSTREAM_CONTRACT,
  PAGE07_UPSTREAM_CONTRACT,
} from "./dependency-contracts";

export const PAGE07_ARCHITECTURE_PROMPT_VERSION =
  "page07-arch-prompt-2026-11-23" as const;

export function buildPage07SectionPromptBlock(
  sectionId: Page07SectionId,
): string {
  const section = PAGE07_SECTION_DEFINITIONS.find(
    (s) => s.section_id === sectionId,
  );
  const spec = page07ContentSpecForSection(sectionId);
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

export function buildPage07ArchitecturePromptBundle(input: {
  input_manifest: readonly Page07InputManifestEntry[];
  missing_inputs: readonly Page07MissingInput[];
  generation_status: string;
}): string {
  const task = PAGE07_MODEL_TASKS[0]!;
  const sectionBlocks = PAGE07_SECTION_DEFINITIONS.map((s) =>
    buildPage07SectionPromptBlock(s.section_id),
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
    `## Page07 Architecture Prompt Bundle (v=${PAGE07_ARCHITECTURE_PROMPT_VERSION})`,
    `task_id: ${task.task_id}`,
    `generation_status: ${input.generation_status}`,
    "",
    "### Page duty",
    "Page07 = Field & Relationship only (场域与关系), and only when the program already set applicability_status=applicable.",
    "Explain whether the setting or an already-stated relationship changes the main decision.",
    "Do NOT decide applicability yourself. Do NOT invent a second main plan.",
    "",
    "### Upstream (read-only)",
    `Page01: ${PAGE07_UPSTREAM_CONTRACT.page01.join("; ")}`,
    `Page02: ${PAGE07_UPSTREAM_CONTRACT.page02.join("; ")}`,
    `Page04: ${PAGE07_UPSTREAM_CONTRACT.page04.join("; ")}`,
    `Page05: ${PAGE07_UPSTREAM_CONTRACT.page05.join("; ")}`,
    `Page06: ${PAGE07_UPSTREAM_CONTRACT.page06.join("; ")}`,
    "",
    "### Downstream (future Page08 — do not implement)",
    `status: ${PAGE07_DOWNSTREAM_CONTRACT.page08.status}`,
    `implemented: ${PAGE07_DOWNSTREAM_CONTRACT.page08.implemented}`,
    "",
    "### Sections",
    sectionBlocks,
    "",
    "### Input manifest",
    ...(manifestLines.length ? manifestLines : ["- (empty)"]),
    "",
    "### Missing inputs",
    ...(gapLines.length ? gapLines : ["- (none)"]),
    "",
    "### Task bans",
    ...task.bans.map((b) => `- ${b}`),
  ].join("\n");
}
