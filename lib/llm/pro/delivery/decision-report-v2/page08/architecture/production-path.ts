/**
 * Page08 architecture production path (Batch 1).
 */

import type { Face08V2 } from "../../schemas";
import { Face08V2Schema } from "../../schemas";
import {
  buildFace08ProductionContext,
  type Face08ProductionContext,
} from "../production";
import {
  assemblePage08InputManifest,
  buildPage08MissingInputs,
  page08FactGapsFromDc,
  resolvePage08GenerationStatus,
  type Page08ArchitectureInputSnapshot,
} from "./assemble-inputs";
import {
  buildPage08ArchitecturePromptBundle,
  PAGE08_ARCHITECTURE_PROMPT_VERSION,
} from "./prompt-templates";
import {
  PAGE08_SECTION_DEFINITIONS,
  normalizePage08ReadingOrder,
  type Page08SectionId,
  type Page08SegmentLetter,
} from "./sections";
import { page08TaskById, type Page08TaskId } from "./tasks";
import type { Page08GenerationStatus, Page08MissingInput } from "./gaps";
import type { Page08InputManifestEntry } from "./input-contracts";
import {
  assertFace08PathIntegrity,
  type Face08UpstreamRefs,
} from "../path-integrity";

export type Page08ArchitectureEnvelope = {
  page_id: "08";
  schema_version: "face08-v2";
  architecture_prompt_version: typeof PAGE08_ARCHITECTURE_PROMPT_VERSION;
  generation_status: Page08GenerationStatus;
  sections: Array<{
    section_id: Page08SectionId;
    segment_letter: Page08SegmentLetter;
    title_zh: string;
    title_en: string;
    required: boolean;
    reading_rank: number;
    information_level: string;
  }>;
  input_manifest: Page08InputManifestEntry[];
  missing_inputs: Page08MissingInput[];
  uncertainty_notes: string[];
  generation_metadata: {
    task_id: Page08TaskId;
    prompt_bundle_chars: number;
    built_at: string;
    llm_invoked: boolean;
  };
};

export type Page08ArchitectureBuildOk = {
  ok: true;
  envelope: Page08ArchitectureEnvelope;
  ctx: Face08ProductionContext;
  architecture_prompt_bundle: string;
  system: string;
  user: string;
  may_invoke_llm: boolean;
};

export type Page08ArchitectureBuildFail = {
  ok: false;
  reason: string;
  detail?: string;
  envelope?: Page08ArchitectureEnvelope;
};

export function buildPage08ArchitectureEnvelope(
  snap: Page08ArchitectureInputSnapshot,
  extras?: {
    llm_invoked?: boolean;
    has_generated_page?: boolean;
    structure_ok?: boolean;
  },
): Page08ArchitectureEnvelope {
  const manifest = assemblePage08InputManifest(snap);
  const fieldGaps = buildPage08MissingInputs(manifest);
  const factGaps = page08FactGapsFromDc(snap.dc);
  const missingMap = new Map<string, Page08MissingInput>();
  for (const g of [...fieldGaps, ...factGaps]) missingMap.set(g.gap_id, g);
  const missing_inputs = [...missingMap.values()];
  const generation_status = resolvePage08GenerationStatus({
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
  const bundle = buildPage08ArchitecturePromptBundle({
    input_manifest: manifest,
    missing_inputs,
    generation_status,
  });
  return {
    page_id: "08",
    schema_version: "face08-v2",
    architecture_prompt_version: PAGE08_ARCHITECTURE_PROMPT_VERSION,
    generation_status,
    sections: PAGE08_SECTION_DEFINITIONS.map((s) => ({
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
      task_id: "page08_monitoring_generate",
      prompt_bundle_chars: bundle.length,
      built_at: new Date().toISOString(),
      llm_invoked: extras?.llm_invoked ?? false,
    },
  };
}

export function buildPage08ArchitectureProduction(input: {
  report_id: string;
  locale: string;
  dc: Parameters<typeof buildFace08ProductionContext>[0]["dc"];
  pack: Parameters<typeof buildFace08ProductionContext>[0]["pack"];
  chart_fact_pack?: string | null;
  page01?: unknown;
  page02?: unknown;
  page04?: unknown;
  page05?: unknown;
  page06?: unknown;
  page07?: unknown;
}): Page08ArchitectureBuildOk | Page08ArchitectureBuildFail {
  const built = buildFace08ProductionContext(input);
  if (!built.ok) {
    return { ok: false, reason: built.reason, detail: built.detail };
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

export function attachPage08ArchitectureToPage(
  page: Face08V2,
  envelope: Page08ArchitectureEnvelope,
): Face08V2 {
  return {
    ...page,
    schema_version: "face08-v2",
    reading_order: normalizePage08ReadingOrder(page.reading_order),
    generation_status: envelope.generation_status,
    input_manifest: envelope.input_manifest,
    missing_inputs: envelope.missing_inputs,
    sections: envelope.sections,
    generation_metadata: envelope.generation_metadata,
    evidence_boundary: {
      ...page.evidence_boundary,
      unresolved_questions: page.evidence_boundary.unresolved_questions?.length
        ? page.evidence_boundary.unresolved_questions
        : envelope.uncertainty_notes.slice(0, 8).map((note) => note.slice(0, 240)),
    },
  };
}

export function validatePage08CanonicalPage(
  raw: unknown,
  upstream: Face08UpstreamRefs,
): { ok: true; page: Face08V2 } | { ok: false; detail: string } {
  const patched =
    raw && typeof raw === "object"
      ? {
          ...(raw as Record<string, unknown>),
          reading_order: normalizePage08ReadingOrder(
            (raw as { reading_order?: readonly string[] }).reading_order,
          ),
        }
      : raw;
  const parsed = Face08V2Schema.safeParse(patched);
  if (!parsed.success) {
    return {
      ok: false,
      detail: parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".")}:${i.message}`)
        .join("; "),
    };
  }
  const integrity = assertFace08PathIntegrity(parsed.data, upstream);
  if (integrity.length) {
    return { ok: false, detail: integrity.join("; ") };
  }
  return { ok: true, page: parsed.data };
}

export function page08TaskInterface(taskId: string) {
  return page08TaskById(taskId);
}
