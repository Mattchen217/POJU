/**
 * Page05 prompt templates — callable from production (not docs-only).
 */

import {
  PAGE05_SECTION_DEFINITIONS,
  type Page05SectionId,
} from "./sections";
import { page05ContentSpecForSection } from "./content-specs";
import { PAGE05_MODEL_TASKS } from "./tasks";
import type { Page05InputManifestEntry } from "./input-contracts";
import type { Page05MissingInput } from "./gaps";
import {
  PAGE05_DOWNSTREAM_CONTRACT,
  PAGE05_UPSTREAM_CONTRACT,
} from "./dependency-contracts";

export const PAGE05_ARCHITECTURE_PROMPT_VERSION =
  "page05-arch-prompt-2026-11-23" as const;

export function buildPage05SectionPromptBlock(
  sectionId: Page05SectionId,
): string {
  const section = PAGE05_SECTION_DEFINITIONS.find(
    (s) => s.section_id === sectionId,
  );
  const spec = page05ContentSpecForSection(sectionId);
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

export function buildPage05ArchitecturePromptBundle(input: {
  input_manifest: readonly Page05InputManifestEntry[];
  missing_inputs: readonly Page05MissingInput[];
  generation_status: string;
}): string {
  const task = PAGE05_MODEL_TASKS[0]!;
  const sectionBlocks = PAGE05_SECTION_DEFINITIONS.map((s) =>
    buildPage05SectionPromptBlock(s.section_id),
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
    `## Page05 Architecture Prompt Bundle (v=${PAGE05_ARCHITECTURE_PROMPT_VERSION})`,
    `task_id: ${task.task_id}`,
    `generation_status: ${input.generation_status}`,
    "",
    "### Page duty",
    "Page05 = Feasible Paths & Strategy Comparison only (可行路径与策略比较).",
    "Identify real feasible paths first, then compare and rank.",
    "Do NOT substitute Page01/02/04/06/07/08.",
    "",
    "### Upstream (read-only; expand into comparable paths)",
    `Page01: ${PAGE05_UPSTREAM_CONTRACT.page01.join("; ")}`,
    `Page02: ${PAGE05_UPSTREAM_CONTRACT.page02.join("; ")}`,
    `Page04: ${PAGE05_UPSTREAM_CONTRACT.page04.join("; ")}`,
    "",
    "### Downstream output stability (do not omit)",
    `Page06 will need: ${PAGE05_DOWNSTREAM_CONTRACT.page06.join("; ")}`,
    `Page08 will need: ${PAGE05_DOWNSTREAM_CONTRACT.page08.join("; ")}`,
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
    "- Do NOT invent cautious paths to pad counts; use cautious_absent_note when none.",
    "- Do NOT invent scores, success %, or unsourced numeric rankings.",
    "- If handling=defer_generation: the program should not have called you.",
    "- Do NOT mint claim/evidence associations the program did not certify.",
    "- Do NOT invent Schema fields outside Face05V2.",
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
