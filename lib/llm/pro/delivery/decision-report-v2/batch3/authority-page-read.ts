/**
 * Unified authority-aware page read — single gate for loadJob, orchestrator
 * DAG unlock, and final V3 merge. Does not call loadJob (no cycles).
 */

import type { PageBlob } from "../batch2/job-store";
import { hashCanonicalPayload } from "../orchestration";
import type { ReportPageId, ReportPageRuntimeState } from "../orchestration/types";
import { readAuthorityPageOutput } from "./auth-output";
import {
  assertGenerationActive,
  readActiveGeneration,
  readGeneration,
} from "./generation-store";
import { readPageFence } from "./page-fence";
import { readPageProvenance } from "./provenance";
import type { Batch3Result, PageFence, PageProvenance } from "./types";
import type { AuthorityPageOutput } from "./auth-output";

export type AuthorityPageVerdict =
  | "valid"
  | "stale"
  | "missing"
  | "unavailable"
  | "mismatch"
  | "not_terminal";

export type AuthorityPageReadResult = {
  verdict: AuthorityPageVerdict;
  detail: string;
  state?: ReportPageRuntimeState;
  output?: unknown;
  fence?: PageFence | null;
  provenance?: PageProvenance | null;
  authority_output?: AuthorityPageOutput | null;
};

const TERMINAL_OUTCOMES = new Set([
  "completed",
  "skipped_not_applicable",
  "insufficient_information",
]);

export function isAuthorityTerminalOutcome(outcome: string | undefined): boolean {
  return !!outcome && TERMINAL_OUTCOMES.has(outcome);
}

/**
 * Validate a page blob (or claim of terminal output) against Batch3 authority.
 * Missing/pending blobs that do not claim a terminal outcome → not_terminal.
 */
export async function readAuthorityGatedPage(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  /** Raw Batch2 page blob, if any. */
  blob?: PageBlob | null;
}): Promise<AuthorityPageReadResult> {
  const blob = input.blob ?? null;
  const claimsTerminal = isAuthorityTerminalOutcome(blob?.state?.outcome);

  if (!blob || !claimsTerminal) {
    return {
      verdict: "not_terminal",
      detail: blob
        ? `page ${input.page_id} outcome=${blob.state.outcome} — no authority required yet`
        : `page ${input.page_id} blob absent`,
    };
  }

  const active = await readActiveGeneration(input.report_id);
  if (!active.ok) {
    return {
      verdict: "unavailable",
      detail: `active read failed: ${active.detail}`,
    };
  }
  if (
    !active.value ||
    active.value.generation_id !== input.generation_id.trim() ||
    active.value.generation_epoch !== input.generation_epoch
  ) {
    return {
      verdict: "stale",
      detail: `active generation mismatch for page ${input.page_id}`,
    };
  }

  const asserted = await assertGenerationActive({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
  });
  if (!asserted.ok) {
    if (
      asserted.code === "kv_unavailable" ||
      asserted.code === "kv_read_failed"
    ) {
      return { verdict: "unavailable", detail: asserted.detail };
    }
    return { verdict: "stale", detail: asserted.detail };
  }

  const gen = await readGeneration(input.report_id, input.generation_id);
  if (!gen.ok) {
    return { verdict: "unavailable", detail: gen.detail };
  }
  if (!gen.value) {
    return {
      verdict: "missing",
      detail: `generation record missing for page ${input.page_id}`,
    };
  }
  if (gen.value.status !== "active") {
    return {
      verdict: "stale",
      detail: `generation status=${gen.value.status}`,
    };
  }
  if (gen.value.generation_epoch !== input.generation_epoch) {
    return {
      verdict: "mismatch",
      detail: `generation epoch ${gen.value.generation_epoch} != ${input.generation_epoch}`,
    };
  }

  const fenceRes = await readPageFence(
    input.report_id,
    input.generation_id,
    input.page_id,
  );
  if (!fenceRes.ok) {
    return { verdict: "unavailable", detail: fenceRes.detail };
  }
  const fence = fenceRes.value;
  if (!fence) {
    return {
      verdict: "missing",
      detail: `page fence missing for ${input.page_id}`,
      fence: null,
    };
  }
  if (fence.status !== "committed") {
    return {
      verdict: "stale",
      detail: `fence status=${fence.status}`,
      fence,
    };
  }
  if (fence.generation_epoch !== input.generation_epoch) {
    return {
      verdict: "mismatch",
      detail: `fence epoch mismatch`,
      fence,
    };
  }
  if (fence.generation_id !== input.generation_id.trim()) {
    return {
      verdict: "mismatch",
      detail: `fence generation_id mismatch`,
      fence,
    };
  }
  if (typeof fence.validity_rev !== "number") {
    return {
      verdict: "mismatch",
      detail: `fence validity_rev missing`,
      fence,
    };
  }
  if (!fence.attempt_id || !fence.output_fingerprint) {
    return {
      verdict: "mismatch",
      detail: `fence missing attempt_id or output_fingerprint`,
      fence,
    };
  }

  const provRes = await readPageProvenance(
    input.report_id,
    input.generation_id,
    input.page_id,
  );
  if (!provRes.ok) {
    return { verdict: "unavailable", detail: provRes.detail, fence };
  }
  const provenance = provRes.value;
  if (!provenance) {
    return {
      verdict: "missing",
      detail: `provenance missing for ${input.page_id}`,
      fence,
      provenance: null,
    };
  }
  if (provenance.stale) {
    return {
      verdict: "stale",
      detail: provenance.stale_reason ?? "provenance marked stale",
      fence,
      provenance,
    };
  }
  if (
    provenance.generation_id !== input.generation_id.trim() ||
    provenance.generation_epoch !== input.generation_epoch ||
    provenance.page_id !== input.page_id
  ) {
    return {
      verdict: "mismatch",
      detail: `provenance identity mismatch`,
      fence,
      provenance,
    };
  }
  if (provenance.validity_rev !== fence.validity_rev) {
    return {
      verdict: "mismatch",
      detail: `provenance validity_rev ${provenance.validity_rev} != fence ${fence.validity_rev}`,
      fence,
      provenance,
    };
  }
  if (provenance.attempt_id !== fence.attempt_id) {
    return {
      verdict: "mismatch",
      detail: `provenance attempt_id mismatch`,
      fence,
      provenance,
    };
  }
  if (provenance.output_fingerprint !== fence.output_fingerprint) {
    return {
      verdict: "mismatch",
      detail: `provenance output_fingerprint mismatch`,
      fence,
      provenance,
    };
  }
  if (!provenance.task_key) {
    return {
      verdict: "mismatch",
      detail: `provenance task_key missing`,
      fence,
      provenance,
    };
  }
  if (
    !provenance.input_fingerprint ||
    !provenance.page_contract_version ||
    !provenance.prompt_version ||
    !provenance.validator_version
  ) {
    return {
      verdict: "mismatch",
      detail: `provenance contract fields incomplete`,
      fence,
      provenance,
    };
  }

  const authRes = await readAuthorityPageOutput(
    input.report_id,
    input.generation_id,
    input.page_id,
  );
  if (!authRes.ok) {
    return {
      verdict: "unavailable",
      detail: authRes.detail,
      fence,
      provenance,
    };
  }
  const authority_output = authRes.value;
  if (!authority_output) {
    return {
      verdict: "missing",
      detail: `authority output missing for ${input.page_id}`,
      fence,
      provenance,
      authority_output: null,
    };
  }
  if (authority_output.output_fingerprint !== fence.output_fingerprint) {
    return {
      verdict: "mismatch",
      detail: `authority output fingerprint mismatch`,
      fence,
      provenance,
      authority_output,
    };
  }
  if (authority_output.validity_rev !== fence.validity_rev) {
    return {
      verdict: "mismatch",
      detail: `authority output validity_rev mismatch`,
      fence,
      provenance,
      authority_output,
    };
  }
  if (authority_output.attempt_id !== fence.attempt_id) {
    return {
      verdict: "mismatch",
      detail: `authority output attempt_id mismatch`,
      fence,
      provenance,
      authority_output,
    };
  }

  if ((blob.validity_rev ?? -1) !== fence.validity_rev) {
    return {
      verdict: "mismatch",
      detail: `blob validity_rev ${blob.validity_rev ?? "absent"} != fence ${fence.validity_rev}`,
      fence,
      provenance,
      authority_output,
    };
  }
  if (blob.authority_output_fingerprint !== fence.output_fingerprint) {
    return {
      verdict: "mismatch",
      detail: `blob authority_output_fingerprint mismatch`,
      fence,
      provenance,
      authority_output,
    };
  }
  if (blob.state.output_fingerprint !== fence.output_fingerprint) {
    return {
      verdict: "mismatch",
      detail: `blob state output_fingerprint mismatch`,
      fence,
      provenance,
      authority_output,
    };
  }

  if (blob.output !== undefined) {
    const recomputed = hashCanonicalPayload(blob.output);
    if (recomputed !== fence.output_fingerprint) {
      return {
        verdict: "mismatch",
        detail: `recomputed blob output fingerprint mismatch`,
        fence,
        provenance,
        authority_output,
      };
    }
  } else if (blob.state.outcome === "completed") {
    return {
      verdict: "mismatch",
      detail: `completed blob missing output payload`,
      fence,
      provenance,
      authority_output,
    };
  }

  return {
    verdict: "valid",
    detail: "authority matches",
    state: blob.state,
    output: blob.output,
    fence,
    provenance,
    authority_output,
  };
}

/**
 * Apply authority gating to a set of raw page blobs for a Batch3 job.
 * unavailable → fail the whole assembly (fail closed).
 * stale/missing/mismatch terminal claims → demoted to pending (no output).
 */
export async function filterPagesThroughAuthority(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  pages: Map<ReportPageId, PageBlob>;
  page_ids: readonly ReportPageId[];
}): Promise<
  Batch3Result<{
    pages: Map<ReportPageId, PageBlob>;
    demotions: Array<{ page_id: ReportPageId; verdict: AuthorityPageVerdict; detail: string }>;
  }>
> {
  const next = new Map<ReportPageId, PageBlob>();
  const demotions: Array<{
    page_id: ReportPageId;
    verdict: AuthorityPageVerdict;
    detail: string;
  }> = [];

  for (const page_id of input.page_ids) {
    const blob = input.pages.get(page_id) ?? null;
    if (!blob) continue;

    if (!isAuthorityTerminalOutcome(blob.state.outcome)) {
      next.set(page_id, blob);
      continue;
    }

    const read = await readAuthorityGatedPage({
      report_id: input.report_id,
      generation_id: input.generation_id,
      generation_epoch: input.generation_epoch,
      page_id,
      blob,
    });

    if (read.verdict === "unavailable") {
      return {
        ok: false,
        code: "kv_read_failed",
        detail: `authority unavailable for page ${page_id}: ${read.detail}`,
      };
    }
    if (read.verdict === "valid") {
      next.set(page_id, blob);
      continue;
    }

    demotions.push({
      page_id,
      verdict: read.verdict,
      detail: read.detail,
    });
    // Keep blob shell for repair/pending diagnostics but strip terminal authority.
    next.set(page_id, {
      ...blob,
      state: {
        ...blob.state,
        outcome: "pending",
        output_fingerprint: undefined,
      },
      output: undefined,
      authority_output_fingerprint: null,
    });
  }

  return { ok: true, value: { pages: next, demotions } };
}

/**
 * Re-validate a page for final merge — prefer Authority Output payload when valid.
 */
export async function assertPageAuthorityForMerge(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  blob?: PageBlob | null;
}): Promise<
  | { ok: true; output: unknown; state: ReportPageRuntimeState }
  | { ok: false; reason: string; verdict: AuthorityPageVerdict }
> {
  const read = await readAuthorityGatedPage(input);
  if (read.verdict === "valid" && read.authority_output) {
    return {
      ok: true,
      output: read.authority_output.output,
      state: read.state ?? {
        page_id: input.page_id,
        outcome: "completed",
        output_fingerprint: read.authority_output.output_fingerprint,
      },
    };
  }
  if (read.verdict === "not_terminal") {
    return {
      ok: false,
      reason: `page ${input.page_id} not terminal for merge`,
      verdict: read.verdict,
    };
  }
  return {
    ok: false,
    reason: `page ${input.page_id} authority ${read.verdict}: ${read.detail}`,
    verdict: read.verdict,
  };
}
