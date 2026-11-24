/**
 * Page08 prompt templates — callable from production (not docs-only).
 */

import { PAGE08_SECTION_DEFINITIONS, type Page08SectionId } from "./sections";
import { page08ContentSpecForSection } from "./content-specs";
import { PAGE08_MODEL_TASKS } from "./tasks";
import type { Page08InputManifestEntry } from "./input-contracts";
import type { Page08MissingInput } from "./gaps";
import {
  PAGE08_DOWNSTREAM_CONTRACT,
  PAGE08_UPSTREAM_CONTRACT,
} from "./dependency-contracts";

export const PAGE08_ARCHITECTURE_PROMPT_VERSION =
  "page08-arch-prompt-2026-11-24" as const;

export function buildPage08SectionPromptBlock(
  sectionId: Page08SectionId,
): string {
  const section = PAGE08_SECTION_DEFINITIONS.find(
    (s) => s.section_id === sectionId,
  );
  const spec = page08ContentSpecForSection(sectionId);
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

export function buildPage08ArchitecturePromptBundle(input: {
  input_manifest: readonly Page08InputManifestEntry[];
  missing_inputs: readonly Page08MissingInput[];
  generation_status: string;
}): string {
  const task = PAGE08_MODEL_TASKS[0]!;
  const sectionBlocks = PAGE08_SECTION_DEFINITIONS.map((s) =>
    buildPage08SectionPromptBlock(s.section_id),
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
    `## Page08 Architecture Prompt Bundle (v=${PAGE08_ARCHITECTURE_PROMPT_VERSION})`,
    `task_id: ${task.task_id}`,
    `generation_status: ${input.generation_status}`,
    "",
    "### Page duty",
    "Page08 = 风险监测与决策复盘. Observe signals. Respond with continue, adjust, pause, stop, or reassess.",
    "Do NOT rewrite Page01, Page05, or Page06. Do NOT invent facts, scores, probabilities, or dates.",
    "Page07 not_applicable does not block. Page07 insufficient_information is a gap, not an applicable analysis. Missing Page07 is a gap.",
    "",
    "### Upstream (read-only)",
    `Page01: ${PAGE08_UPSTREAM_CONTRACT.page01.join("; ")}`,
    `Page02: ${PAGE08_UPSTREAM_CONTRACT.page02.join("; ")}`,
    `Page04: ${PAGE08_UPSTREAM_CONTRACT.page04.join("; ")}`,
    `Page05: ${PAGE08_UPSTREAM_CONTRACT.page05.join("; ")}`,
    `Page06: ${PAGE08_UPSTREAM_CONTRACT.page06.join("; ")}`,
    `Page07: ${PAGE08_UPSTREAM_CONTRACT.page07.join("; ")}`,
    "",
    "### Downstream",
    `status: ${PAGE08_DOWNSTREAM_CONTRACT.none.status}`,
    `implemented: ${PAGE08_DOWNSTREAM_CONTRACT.none.implemented}`,
    PAGE08_DOWNSTREAM_CONTRACT.none.note,
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
