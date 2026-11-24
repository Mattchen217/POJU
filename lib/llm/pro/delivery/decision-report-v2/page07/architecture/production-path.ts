/**
 * Page07 architecture production path (Batch 1).
 */

import type { Face07V2 } from "../../schemas";
import { Face07V2Schema } from "../../schemas";
import {
  buildFace07ProductionContext,
  type Face07ProductionContext,
} from "../production";
import {
  assemblePage07InputManifest,
  buildPage07MissingInputs,
  page07FactGapsFromDc,
  resolvePage07GenerationStatus,
  type Page07ArchitectureInputSnapshot,
} from "./assemble-inputs";
import {
  buildPage07ArchitecturePromptBundle,
  PAGE07_ARCHITECTURE_PROMPT_VERSION,
} from "./prompt-templates";
import {
  PAGE07_SECTION_DEFINITIONS,
  normalizePage07ReadingOrder,
  type Page07SectionId,
  type Page07SegmentLetter,
} from "./sections";
import { page07TaskById, type Page07TaskId } from "./tasks";
import type { Page07GenerationStatus, Page07MissingInput } from "./gaps";
import type { Page07InputManifestEntry } from "./input-contracts";
import type { Page07ApplicabilityStatus } from "../applicability";
import {
  assertFace07PathIntegrity,
  type Face07UpstreamRefs,
} from "../path-integrity";

export type Page07ArchitectureEnvelope = {
  page_id: "07";
  schema_version: "face07-v2";
  architecture_prompt_version: typeof PAGE07_ARCHITECTURE_PROMPT_VERSION;
  applicability_status: Page07ApplicabilityStatus;
  applicability_reason: string;
  generation_status: Page07GenerationStatus;
  sections: Array<{
    section_id: Page07SectionId;
    segment_letter: Page07SegmentLetter;
    title_zh: string;
    title_en: string;
    required: boolean;
    reading_rank: number;
    information_level: string;
  }>;
  input_manifest: Page07InputManifestEntry[];
  missing_inputs: Page07MissingInput[];
  uncertainty_notes: string[];
  generation_metadata: {
    task_id: Page07TaskId;
    prompt_bundle_chars: number;
    built_at: string;
    llm_invoked: boolean;
  };
};

export type Page07ArchitectureBuildOk = {
  ok: true;
  envelope: Page07ArchitectureEnvelope;
  ctx: Face07ProductionContext;
  architecture_prompt_bundle: string;
  system: string;
  user: string;
  may_invoke_llm: boolean;
};

export type Page07ArchitectureBuildFail = {
  ok: false;
  reason: string;
  detail?: string;
  envelope?: Page07ArchitectureEnvelope;
};

export function buildPage07ArchitectureEnvelope(
  snap: Page07ArchitectureInputSnapshot,
  extras?: {
    llm_invoked?: boolean;
    has_generated_page?: boolean;
    structure_ok?: boolean;
    applicability_reason?: string;
  },
): Page07ArchitectureEnvelope {
  const manifest = assemblePage07InputManifest(snap);
  const fieldGaps = buildPage07MissingInputs(manifest, snap.applicability_status);
  const factGaps = page07FactGapsFromDc(snap.dc, snap.applicability_status);
  const missingMap = new Map<string, Page07MissingInput>();
  for (const g of [...fieldGaps, ...factGaps]) missingMap.set(g.gap_id, g);
  const missing_inputs = [...missingMap.values()];
  const generation_status = resolvePage07GenerationStatus({
    applicability: snap.applicability_status,
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
  const bundle = buildPage07ArchitecturePromptBundle({
    input_manifest: manifest,
    missing_inputs,
    generation_status,
  });
  return {
    page_id: "07",
    schema_version: "face07-v2",
    architecture_prompt_version: PAGE07_ARCHITECTURE_PROMPT_VERSION,
    applicability_status: snap.applicability_status,
    applicability_reason: extras?.applicability_reason ?? snap.applicability_status,
    generation_status,
    sections: PAGE07_SECTION_DEFINITIONS.map((s) => ({
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
      task_id: "page07_field_generate",
      prompt_bundle_chars: bundle.length,
      built_at: new Date().toISOString(),
      llm_invoked: extras?.llm_invoked ?? false,
    },
  };
}

export function buildPage07ArchitectureProduction(input: {
  report_id: string;
  locale: string;
  dc: Parameters<typeof buildFace07ProductionContext>[0]["dc"];
  pack: Parameters<typeof buildFace07ProductionContext>[0]["pack"];
  chart_fact_pack?: string | null;
  page01?: unknown;
  page02?: unknown;
  page04?: unknown;
  page05?: unknown;
  page06?: unknown;
  authorized_partner_profile?: boolean;
}): Page07ArchitectureBuildOk | Page07ArchitectureBuildFail {
  const built = buildFace07ProductionContext(input);
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

export function attachPage07ArchitectureToPage(
  page: Face07V2,
  envelope: Page07ArchitectureEnvelope,
): Face07V2 {
  return {
    ...page,
    schema_version: "face07-v2",
    reading_order: normalizePage07ReadingOrder(page.reading_order),
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
          : page.applicability_status === "applicable"
            ? envelope.uncertainty_notes.slice(0, 8)
            : page.evidence_boundary.uncertainty_notes,
    },
  };
}

export function validatePage07CanonicalPage(
  raw: unknown,
  upstream: Face07UpstreamRefs,
): { ok: true; page: Face07V2 } | { ok: false; detail: string } {
  const patched =
    raw && typeof raw === "object"
      ? {
          ...(raw as Record<string, unknown>),
          reading_order: normalizePage07ReadingOrder(
            (raw as { reading_order?: readonly string[] }).reading_order,
          ),
        }
      : raw;
  const parsed = Face07V2Schema.safeParse(patched);
  if (!parsed.success) {
    return {
      ok: false,
      detail: parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".")}:${i.message}`)
        .join("; "),
    };
  }
  const integrity = assertFace07PathIntegrity(parsed.data, upstream);
  if (integrity.length) {
    return { ok: false, detail: integrity.join("; ") };
  }
  return { ok: true, page: parsed.data };
}

export function page07TaskInterface(taskId: string) {
  return page07TaskById(taskId);
}
