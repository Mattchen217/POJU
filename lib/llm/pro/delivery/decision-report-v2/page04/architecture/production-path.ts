/**
 * Page04 architecture production path (Batch 1).
 */

import type { Face04V2 } from "../../schemas";
import { Face04V2Schema } from "../../schemas";
import {
  buildFace04ProductionContext,
  type Face04ProductionContext,
} from "../production";
import {
  assemblePage04InputManifest,
  buildPage04MissingInputs,
  page04FactGapsFromDc,
  resolvePage04GenerationStatus,
  type Page04ArchitectureInputSnapshot,
} from "./assemble-inputs";
import {
  buildPage04ArchitecturePromptBundle,
  PAGE04_ARCHITECTURE_PROMPT_VERSION,
} from "./prompt-templates";
import {
  PAGE04_SECTION_DEFINITIONS,
  normalizePage04ReadingOrder,
  type Page04SectionId,
} from "./sections";
import { page04TaskById, type Page04TaskId } from "./tasks";
import type { Page04GenerationStatus, Page04MissingInput } from "./gaps";
import type { Page04InputManifestEntry } from "./input-contracts";
import { assertFace04UnitIdIntegrity } from "../content-units";

export type Page04ArchitectureEnvelope = {
  page_id: "04";
  schema_version: "face04-v2";
  architecture_prompt_version: typeof PAGE04_ARCHITECTURE_PROMPT_VERSION;
  generation_status: Page04GenerationStatus;
  sections: Array<{
    section_id: Page04SectionId;
    segment_letter: string;
    title_zh: string;
    title_en: string;
    required: boolean;
    reading_rank: number;
    information_level: string;
  }>;
  input_manifest: Page04InputManifestEntry[];
  missing_inputs: Page04MissingInput[];
  uncertainty_notes: string[];
  generation_metadata: {
    task_id: Page04TaskId;
    prompt_bundle_chars: number;
    built_at: string;
    llm_invoked: boolean;
  };
};

export type Page04ArchitectureBuildOk = {
  ok: true;
  envelope: Page04ArchitectureEnvelope;
  ctx: Face04ProductionContext;
  architecture_prompt_bundle: string;
  system: string;
  user: string;
  may_invoke_llm: boolean;
};

export type Page04ArchitectureBuildFail = {
  ok: false;
  reason: string;
  detail?: string;
  envelope?: Page04ArchitectureEnvelope;
};

export function buildPage04ArchitectureEnvelope(
  snap: Page04ArchitectureInputSnapshot,
  extras?: {
    llm_invoked?: boolean;
    has_generated_page?: boolean;
    structure_ok?: boolean;
  },
): Page04ArchitectureEnvelope {
  const manifest = assemblePage04InputManifest(snap);
  const fieldGaps = buildPage04MissingInputs(manifest);
  const factGaps = page04FactGapsFromDc(snap.dc);
  const missingMap = new Map<string, Page04MissingInput>();
  for (const g of [...fieldGaps, ...factGaps]) missingMap.set(g.gap_id, g);
  const missing_inputs = [...missingMap.values()];

  const generation_status = resolvePage04GenerationStatus({
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

  const bundle = buildPage04ArchitecturePromptBundle({
    input_manifest: manifest,
    missing_inputs,
    generation_status,
  });

  return {
    page_id: "04",
    schema_version: "face04-v2",
    architecture_prompt_version: PAGE04_ARCHITECTURE_PROMPT_VERSION,
    generation_status,
    sections: PAGE04_SECTION_DEFINITIONS.map((s) => ({
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
      task_id: "page04_content_units_generate",
      prompt_bundle_chars: bundle.length,
      built_at: new Date().toISOString(),
      llm_invoked: extras?.llm_invoked ?? false,
    },
  };
}

/**
 * Thin wrapper over UNIQUE production entry: buildFace04ProductionContext.
 */
export function buildPage04ArchitectureProduction(input: {
  report_id: string;
  locale: string;
  dc: Parameters<typeof buildFace04ProductionContext>[0]["dc"];
  pack: Parameters<typeof buildFace04ProductionContext>[0]["pack"];
  chart_fact_pack?: string | null;
  page01?: unknown;
  page02?: unknown;
}): Page04ArchitectureBuildOk | Page04ArchitectureBuildFail {
  const built = buildFace04ProductionContext(input);
  if (!built.ok) {
    return {
      ok: false,
      reason: built.reason,
      detail: built.detail,
    };
  }
  const ok = built;
  return {
    ok: true,
    envelope: ok.ctx.architecture,
    ctx: ok.ctx,
    architecture_prompt_bundle: ok.ctx.architecture_prompt_bundle,
    system: ok.ctx.system,
    user: ok.ctx.user,
    may_invoke_llm: ok.ctx.may_invoke_llm,
  };
}

export function attachPage04ArchitectureToPage(
  page: Face04V2,
  envelope: Page04ArchitectureEnvelope,
): Face04V2 & {
  generation_status: Page04GenerationStatus;
  input_manifest: Page04InputManifestEntry[];
  missing_inputs: Page04MissingInput[];
  sections: Page04ArchitectureEnvelope["sections"];
  generation_metadata: Page04ArchitectureEnvelope["generation_metadata"];
} {
  const uncertainty = [
    ...page.evidence_boundary.uncertainty_notes,
    ...envelope.uncertainty_notes.filter(
      (n) => !page.evidence_boundary.uncertainty_notes.includes(n),
    ),
  ].slice(0, 8);

  const merged: Face04V2 = {
    ...page,
    reading_order: normalizePage04ReadingOrder(page.reading_order),
    evidence_boundary: {
      ...page.evidence_boundary,
      uncertainty_notes:
        uncertainty.length > 0
          ? uncertainty
          : page.evidence_boundary.uncertainty_notes,
    },
  };

  return {
    ...merged,
    generation_status: envelope.generation_status,
    input_manifest: envelope.input_manifest,
    missing_inputs: envelope.missing_inputs,
    sections: envelope.sections,
    generation_metadata: {
      ...envelope.generation_metadata,
      llm_invoked: envelope.generation_metadata.llm_invoked,
    },
  };
}

export function validatePage04CanonicalPage(raw: unknown):
  | { ok: true; page: Face04V2 }
  | { ok: false; reason: string; detail?: string } {
  const patched =
    raw && typeof raw === "object"
      ? {
          ...(raw as Record<string, unknown>),
          reading_order: normalizePage04ReadingOrder(
            (raw as { reading_order?: readonly string[] }).reading_order,
          ),
        }
      : raw;
  const parsed = Face04V2Schema.safeParse(patched);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "face04_schema_invalid",
      detail: parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".")}:${i.message}`)
        .join("; "),
    };
  }
  const integrity = assertFace04UnitIdIntegrity(parsed.data);
  if (integrity.length) {
    return {
      ok: false,
      reason: "face04_unit_integrity",
      detail: integrity.slice(0, 8).join("; "),
    };
  }
  return { ok: true, page: parsed.data };
}

export function page04TaskInterface(taskId: Page04TaskId): {
  task: NonNullable<ReturnType<typeof page04TaskById>>;
  invoke: "content_body_v3_face04" | "face04_repair";
} | null {
  const task = page04TaskById(taskId);
  if (!task) return null;
  return {
    task,
    invoke:
      taskId === "page04_content_units_repair"
        ? "face04_repair"
        : "content_body_v3_face04",
  };
}
