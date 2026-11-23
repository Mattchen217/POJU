/**
 * Page06 architecture production path (Batch 1).
 */

import type { Face06V2 } from "../../schemas";
import { Face06V2Schema } from "../../schemas";
import {
  buildFace06ProductionContext,
  type Face06ProductionContext,
} from "../production";
import {
  assemblePage06InputManifest,
  buildPage06MissingInputs,
  page06FactGapsFromDc,
  resolvePage06GenerationStatus,
  type Page06ArchitectureInputSnapshot,
} from "./assemble-inputs";
import {
  buildPage06ArchitecturePromptBundle,
  PAGE06_ARCHITECTURE_PROMPT_VERSION,
} from "./prompt-templates";
import {
  PAGE06_SECTION_DEFINITIONS,
  normalizePage06ReadingOrder,
  type Page06SectionId,
  type Page06SegmentLetter,
} from "./sections";
import { page06TaskById, type Page06TaskId } from "./tasks";
import type { Page06GenerationStatus, Page06MissingInput } from "./gaps";
import type { Page06InputManifestEntry } from "./input-contracts";
import {
  assertFace06PathIntegrity,
  type Face06Page05PathSets,
} from "../path-integrity";

export type Page06ArchitectureEnvelope = {
  page_id: "06";
  schema_version: "face06-v2";
  architecture_prompt_version: typeof PAGE06_ARCHITECTURE_PROMPT_VERSION;
  generation_status: Page06GenerationStatus;
  sections: Array<{
    section_id: Page06SectionId;
    segment_letter: Page06SegmentLetter;
    title_zh: string;
    title_en: string;
    required: boolean;
    reading_rank: number;
    information_level: string;
  }>;
  input_manifest: Page06InputManifestEntry[];
  missing_inputs: Page06MissingInput[];
  uncertainty_notes: string[];
  generation_metadata: {
    task_id: Page06TaskId;
    prompt_bundle_chars: number;
    built_at: string;
    llm_invoked: boolean;
  };
};

export type Page06ArchitectureBuildOk = {
  ok: true;
  envelope: Page06ArchitectureEnvelope;
  ctx: Face06ProductionContext;
  architecture_prompt_bundle: string;
  system: string;
  user: string;
  may_invoke_llm: boolean;
};

export type Page06ArchitectureBuildFail = {
  ok: false;
  reason: string;
  detail?: string;
  envelope?: Page06ArchitectureEnvelope;
};

export function buildPage06ArchitectureEnvelope(
  snap: Page06ArchitectureInputSnapshot,
  extras?: {
    llm_invoked?: boolean;
    has_generated_page?: boolean;
    structure_ok?: boolean;
  },
): Page06ArchitectureEnvelope {
  const manifest = assemblePage06InputManifest(snap);
  const fieldGaps = buildPage06MissingInputs(manifest);
  const factGaps = page06FactGapsFromDc(snap.dc);
  const missingMap = new Map<string, Page06MissingInput>();
  for (const g of [...fieldGaps, ...factGaps]) missingMap.set(g.gap_id, g);
  const missing_inputs = [...missingMap.values()];

  const generation_status = resolvePage06GenerationStatus({
    missing_inputs,
    structure_ok: extras?.structure_ok ?? true,
    has_generated_page: extras?.has_generated_page ?? false,
  });

  const uncertainty_notes = missing_inputs
    .filter(
      (g) =>
        g.handling === "show_gap_note_only" ||
        g.handling === "generate_conditional_only" ||
        g.status === "conflict" ||
        g.status === "unverified",
    )
    .slice(0, 8)
    .map((g) => `${g.field_id}: ${g.affects_content}`);

  const bundle = buildPage06ArchitecturePromptBundle({
    input_manifest: manifest,
    missing_inputs,
    generation_status,
  });

  return {
    page_id: "06",
    schema_version: "face06-v2",
    architecture_prompt_version: PAGE06_ARCHITECTURE_PROMPT_VERSION,
    generation_status,
    sections: PAGE06_SECTION_DEFINITIONS.map((s) => ({
      section_id: s.section_id,
      segment_letter: s.segment_letter,
      title_zh: s.title_zh,
      title_en: s.title_en,
      required: s.required,
      reading_rank: s.reading_rank,
      information_level: s.information_level,
    })),
    input_manifest: manifest,
    missing_inputs,
    uncertainty_notes:
      uncertainty_notes.length > 0
        ? uncertainty_notes
        : ["（无程序缺口说明）"],
    generation_metadata: {
      task_id: "page06_execution_generate",
      prompt_bundle_chars: bundle.length,
      built_at: new Date().toISOString(),
      llm_invoked: extras?.llm_invoked ?? false,
    },
  };
}

export function buildPage06ArchitectureProduction(input: {
  report_id: string;
  locale: string;
  dc: Parameters<typeof buildFace06ProductionContext>[0]["dc"];
  pack: Parameters<typeof buildFace06ProductionContext>[0]["pack"];
  chart_fact_pack?: string | null;
  page01?: unknown;
  page02?: unknown;
  page04?: unknown;
  page05?: unknown;
}): Page06ArchitectureBuildOk | Page06ArchitectureBuildFail {
  const built = buildFace06ProductionContext(input);
  if (!built.ok) {
    return {
      ok: false,
      reason: built.reason,
      detail: built.detail,
    };
  }
  return {
    ok: true,
    envelope: built.ctx.architecture,
    ctx: built.ctx,
    architecture_prompt_bundle: built.ctx.architecture_prompt_bundle,
    system: built.ctx.system,
    user: built.ctx.user,
    may_invoke_llm: built.ctx.may_invoke_llm,
  };
}

export function attachPage06ArchitectureToPage(
  page: Face06V2,
  envelope: Page06ArchitectureEnvelope,
): Face06V2 {
  return {
    ...page,
    schema_version: "face06-v2",
    reading_order: normalizePage06ReadingOrder(page.reading_order),
    generation_status: envelope.generation_status,
    input_manifest: envelope.input_manifest,
    missing_inputs: envelope.missing_inputs,
    sections: envelope.sections,
    generation_metadata: envelope.generation_metadata,
    evidence_boundary: {
      ...page.evidence_boundary,
      uncertainty_notes:
        page.evidence_boundary.uncertainty_notes?.length
          ? page.evidence_boundary.uncertainty_notes
          : envelope.uncertainty_notes.slice(0, 8),
    },
  };
}

export function validatePage06CanonicalPage(
  raw: unknown,
  page05Paths: Face06Page05PathSets,
): { ok: true; page: Face06V2 } | { ok: false; detail: string } {
  const patched =
    raw && typeof raw === "object"
      ? {
          ...(raw as Record<string, unknown>),
          reading_order: normalizePage06ReadingOrder(
            (raw as { reading_order?: readonly string[] }).reading_order,
          ),
        }
      : raw;
  const parsed = Face06V2Schema.safeParse(patched);
  if (!parsed.success) {
    return {
      ok: false,
      detail: parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".")}:${i.message}`)
        .join("; "),
    };
  }
  const integrity = assertFace06PathIntegrity(parsed.data, page05Paths);
  if (integrity.length) {
    return { ok: false, detail: integrity.join("; ") };
  }
  return { ok: true, page: parsed.data };
}

export function page06TaskInterface(taskId: string) {
  return page06TaskById(taskId);
}
