/**
 * Page02 architecture production path (Batch 1).
 *
 * input read → integrity check → gap list → context → prompt bundle →
 * task interface → (optional) structured result → schema validate →
 * attach architecture envelope → persist-ready page.
 *
 * Does NOT call the LLM for quality verification in this batch.
 */

import type { Face02V2 } from "../../schemas";
import { Face02V2Schema } from "../../schemas";
import {
  buildFace02ProductionContext,
  type Face02ProductionContext,
  type Face02ProductionBuildOk,
  type Face02ProductionBuildFail,
} from "../production";
import {
  assemblePage02InputManifest,
  buildPage02MissingInputs,
  page02FactGapsFromDc,
  resolvePage02GenerationStatus,
  type Page02ArchitectureInputSnapshot,
} from "./assemble-inputs";
import {
  buildPage02ArchitecturePromptBundle,
  PAGE02_ARCHITECTURE_PROMPT_VERSION,
} from "./prompt-templates";
import {
  PAGE02_SECTION_DEFINITIONS,
  page02DefaultReadingOrder,
  type Page02SectionId,
} from "./sections";
import { page02TaskById, type Page02TaskId } from "./tasks";
import type { Page02GenerationStatus, Page02MissingInput } from "./gaps";
import type { Page02InputManifestEntry } from "./input-contracts";

export type Page02ArchitectureEnvelope = {
  page_id: "02";
  schema_version: "face02-v2";
  architecture_prompt_version: typeof PAGE02_ARCHITECTURE_PROMPT_VERSION;
  generation_status: Page02GenerationStatus;
  sections: Array<{
    section_id: Page02SectionId;
    segment_letter: string;
    title_zh: string;
    title_en: string;
    required: boolean;
    reading_rank: number;
    information_level: string;
  }>;
  input_manifest: Page02InputManifestEntry[];
  missing_inputs: Page02MissingInput[];
  uncertainty_notes: string[];
  generation_metadata: {
    task_id: Page02TaskId;
    prompt_bundle_chars: number;
    built_at: string;
    llm_invoked: boolean;
  };
};

export type Page02ArchitectureBuildOk = {
  ok: true;
  envelope: Page02ArchitectureEnvelope;
  ctx: Face02ProductionContext;
  /** Prompt text actually injectable into Face02 generate. */
  architecture_prompt_bundle: string;
  /** Combined system/user from Face02 production + architecture bundle. */
  system: string;
  user: string;
  /** Whether LLM call is allowed under gap rules. */
  may_invoke_llm: boolean;
};

export type Page02ArchitectureBuildFail = {
  ok: false;
  reason: string;
  detail?: string;
  envelope?: Page02ArchitectureEnvelope;
};

export function buildPage02ArchitectureEnvelope(
  snap: Page02ArchitectureInputSnapshot,
  extras?: {
    registry_claim_count?: number;
    approved_reading_count?: number;
    llm_invoked?: boolean;
    has_generated_page?: boolean;
    structure_ok?: boolean;
  },
): Page02ArchitectureEnvelope {
  const manifest = assemblePage02InputManifest({
    ...snap,
    approved_reading_count:
      extras?.approved_reading_count ?? snap.approved_reading_count,
    registry_claim_count:
      extras?.registry_claim_count ?? snap.registry_claim_count,
  });
  const fieldGaps = buildPage02MissingInputs(manifest);
  const factGaps = page02FactGapsFromDc(snap.dc);
  // Dedupe by gap_id
  const missingMap = new Map<string, Page02MissingInput>();
  for (const g of [...fieldGaps, ...factGaps]) missingMap.set(g.gap_id, g);
  const missing_inputs = [...missingMap.values()];

  const generation_status = resolvePage02GenerationStatus({
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
    .map(
      (g) =>
        `[${g.status}] ${g.field_id}: ${g.affects_content} — ${g.follow_up_collect_hint}`,
    )
    .slice(0, 8);

  const prompt_bundle = buildPage02ArchitecturePromptBundle({
    input_manifest: manifest,
    missing_inputs,
    generation_status,
  });

  return {
    page_id: "02",
    schema_version: "face02-v2",
    architecture_prompt_version: PAGE02_ARCHITECTURE_PROMPT_VERSION,
    generation_status,
    sections: PAGE02_SECTION_DEFINITIONS.map((s) => ({
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
    uncertainty_notes,
    generation_metadata: {
      task_id: "page02_content_units_generate",
      prompt_bundle_chars: prompt_bundle.length,
      built_at: new Date().toISOString(),
      llm_invoked: Boolean(extras?.llm_invoked),
    },
  };
}

/**
 * Full architecture production build — wires existing Face02 context + gap envelope.
 * Does not invoke the model.
 */
export function buildPage02ArchitectureProduction(input: {
  report_id: string;
  locale: string;
  dc: Parameters<typeof buildFace02ProductionContext>[0]["dc"];
  pack: Parameters<typeof buildFace02ProductionContext>[0]["pack"];
  chart_fact_pack?: string | null;
  ziwei_fact_pack?: Parameters<
    typeof buildFace02ProductionContext
  >[0]["ziwei_fact_pack"];
  bazi_available?: boolean;
  ziwei_available?: boolean;
  page01?: unknown;
}): Page02ArchitectureBuildOk | Page02ArchitectureBuildFail {
  const built = buildFace02ProductionContext(input);
  if (!built.ok) {
    const fail = built as Face02ProductionBuildFail;
    const envelope = buildPage02ArchitectureEnvelope(
      {
        report_id: input.report_id,
        locale: input.locale,
        dc: input.dc,
        pack: input.pack ?? null,
        page01_core_judgment: null,
        available_domains: [],
        approved_reading_count: 0,
        registry_claim_count: 0,
      },
      { structure_ok: false, has_generated_page: false },
    );
    return {
      ok: false,
      reason: fail.reason,
      detail: fail.detail,
      envelope,
    };
  }

  const ok = built as Face02ProductionBuildOk;
  const snap: Page02ArchitectureInputSnapshot = {
    report_id: input.report_id,
    locale: input.locale,
    dc: input.dc,
    pack: input.pack ?? null,
    page01_core_judgment: ok.ctx.page01_core_judgment,
    available_domains: ok.ctx.available_domains,
    approved_reading_count: ok.ctx.slice.personal_analysis.approved_readings.length,
    registry_claim_count: Object.keys(ok.ctx.registry.claims).length,
  };

  const envelope = buildPage02ArchitectureEnvelope(snap, {
    has_generated_page: false,
    structure_ok: true,
    llm_invoked: false,
  });

  const architecture_prompt_bundle = buildPage02ArchitecturePromptBundle({
    input_manifest: envelope.input_manifest,
    missing_inputs: envelope.missing_inputs,
    generation_status: envelope.generation_status,
  });

  const blocking = envelope.generation_status === "blocked_on_required_inputs";
  const may_invoke_llm = !blocking;

  const system = [ok.ctx.system, "", architecture_prompt_bundle].join("\n");
  const user = ok.ctx.user;

  return {
    ok: true,
    envelope,
    ctx: {
      ...ok.ctx,
      system,
      user,
    },
    architecture_prompt_bundle,
    system,
    user,
    may_invoke_llm,
  };
}

/** Attach architecture fields onto a validated Face02V2 page (canonical). */
export function attachPage02ArchitectureToPage(
  page: Face02V2,
  envelope: Page02ArchitectureEnvelope,
): Face02V2 & {
  generation_status: Page02GenerationStatus;
  input_manifest: Page02InputManifestEntry[];
  missing_inputs: Page02MissingInput[];
  sections: Page02ArchitectureEnvelope["sections"];
  generation_metadata: Page02ArchitectureEnvelope["generation_metadata"];
} {
  const uncertainty = [
    ...page.explanation_boundary.uncertainty_notes,
    ...envelope.uncertainty_notes.filter(
      (n) => !page.explanation_boundary.uncertainty_notes.includes(n),
    ),
  ].slice(0, 8);

  const merged: Face02V2 = {
    ...page,
    reading_order: page.reading_order?.length
      ? page.reading_order
      : page02DefaultReadingOrder(),
    explanation_boundary: {
      ...page.explanation_boundary,
      uncertainty_notes:
        uncertainty.length > 0
          ? uncertainty
          : page.explanation_boundary.uncertainty_notes,
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

/** Validate structured model/fixture output as Face02V2 (architecture gate). */
export function validatePage02CanonicalPage(raw: unknown):
  | { ok: true; page: Face02V2 }
  | { ok: false; reason: string; detail?: string } {
  const parsed = Face02V2Schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "face02_schema_invalid",
      detail: parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".")}:${i.message}`)
        .join("; "),
    };
  }
  return { ok: true, page: parsed.data };
}

export function page02TaskInterface(taskId: Page02TaskId): {
  task: NonNullable<ReturnType<typeof page02TaskById>>;
  invoke: "content_body_v3_face02" | "face02_repair";
} | null {
  const task = page02TaskById(taskId);
  if (!task) return null;
  return {
    task,
    invoke:
      taskId === "page02_content_units_repair"
        ? "face02_repair"
        : "content_body_v3_face02",
  };
}
