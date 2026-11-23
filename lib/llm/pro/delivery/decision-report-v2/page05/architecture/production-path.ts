/**
 * Page05 architecture production path (Batch 1).
 */

import type { Face05V2 } from "../../schemas";
import { Face05V2Schema } from "../../schemas";
import {
  buildFace05ProductionContext,
  type Face05ProductionContext,
} from "../production";
import {
  assemblePage05InputManifest,
  buildPage05MissingInputs,
  page05FactGapsFromDc,
  resolvePage05GenerationStatus,
  type Page05ArchitectureInputSnapshot,
} from "./assemble-inputs";
import {
  buildPage05ArchitecturePromptBundle,
  PAGE05_ARCHITECTURE_PROMPT_VERSION,
} from "./prompt-templates";
import {
  PAGE05_SECTION_DEFINITIONS,
  normalizePage05ReadingOrder,
  type Page05SectionId,
} from "./sections";
import { page05TaskById, type Page05TaskId } from "./tasks";
import type { Page05GenerationStatus, Page05MissingInput } from "./gaps";
import type { Page05InputManifestEntry } from "./input-contracts";
import { assertFace05PathIdIntegrity } from "../path-units";

export type Page05ArchitectureEnvelope = {
  page_id: "05";
  schema_version: "face05-v2";
  architecture_prompt_version: typeof PAGE05_ARCHITECTURE_PROMPT_VERSION;
  generation_status: Page05GenerationStatus;
  sections: Array<{
    section_id: Page05SectionId;
    segment_letter: "A" | "B" | "C" | "D" | "E";
    title_zh: string;
    title_en: string;
    required: boolean;
    reading_rank: number;
    information_level: string;
  }>;
  input_manifest: Page05InputManifestEntry[];
  missing_inputs: Page05MissingInput[];
  uncertainty_notes: string[];
  generation_metadata: {
    task_id: Page05TaskId;
    prompt_bundle_chars: number;
    built_at: string;
    llm_invoked: boolean;
  };
};

export type Page05ArchitectureBuildOk = {
  ok: true;
  envelope: Page05ArchitectureEnvelope;
  ctx: Face05ProductionContext;
  architecture_prompt_bundle: string;
  system: string;
  user: string;
  may_invoke_llm: boolean;
};

export type Page05ArchitectureBuildFail = {
  ok: false;
  reason: string;
  detail?: string;
  envelope?: Page05ArchitectureEnvelope;
};

export function buildPage05ArchitectureEnvelope(
  snap: Page05ArchitectureInputSnapshot,
  extras?: {
    llm_invoked?: boolean;
    has_generated_page?: boolean;
    structure_ok?: boolean;
  },
): Page05ArchitectureEnvelope {
  const manifest = assemblePage05InputManifest(snap);
  const fieldGaps = buildPage05MissingInputs(manifest);
  const factGaps = page05FactGapsFromDc(snap.dc);
  const missingMap = new Map<string, Page05MissingInput>();
  for (const g of [...fieldGaps, ...factGaps]) missingMap.set(g.gap_id, g);
  const missing_inputs = [...missingMap.values()];

  const generation_status = resolvePage05GenerationStatus({
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

  const bundle = buildPage05ArchitecturePromptBundle({
    input_manifest: manifest,
    missing_inputs,
    generation_status,
  });

  return {
    page_id: "05",
    schema_version: "face05-v2",
    architecture_prompt_version: PAGE05_ARCHITECTURE_PROMPT_VERSION,
    generation_status,
    sections: PAGE05_SECTION_DEFINITIONS.map((s) => ({
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
      task_id: "page05_paths_generate",
      prompt_bundle_chars: bundle.length,
      built_at: new Date().toISOString(),
      llm_invoked: extras?.llm_invoked ?? false,
    },
  };
}

export function buildPage05ArchitectureProduction(input: {
  report_id: string;
  locale: string;
  dc: Parameters<typeof buildFace05ProductionContext>[0]["dc"];
  pack: Parameters<typeof buildFace05ProductionContext>[0]["pack"];
  chart_fact_pack?: string | null;
  page01?: unknown;
  page02?: unknown;
  page04?: unknown;
}): Page05ArchitectureBuildOk | Page05ArchitectureBuildFail {
  const built = buildFace05ProductionContext(input);
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

export function attachPage05ArchitectureToPage(
  page: Face05V2,
  envelope: Page05ArchitectureEnvelope,
): Face05V2 {
  return {
    ...page,
    schema_version: "face05-v2",
    reading_order: normalizePage05ReadingOrder(page.reading_order),
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

export function validatePage05CanonicalPage(
  raw: unknown,
): { ok: true; page: Face05V2 } | { ok: false; detail: string } {
  const patched =
    raw && typeof raw === "object"
      ? {
          ...(raw as Record<string, unknown>),
          reading_order: normalizePage05ReadingOrder(
            (raw as { reading_order?: readonly string[] }).reading_order,
          ),
        }
      : raw;
  const parsed = Face05V2Schema.safeParse(patched);
  if (!parsed.success) {
    return {
      ok: false,
      detail: parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".")}:${i.message}`)
        .join("; "),
    };
  }
  const integrity = assertFace05PathIdIntegrity(parsed.data);
  if (integrity.length) {
    return { ok: false, detail: integrity.join("; ") };
  }
  return { ok: true, page: parsed.data };
}

export function page05TaskInterface(taskId: string) {
  return page05TaskById(taskId);
}
