/**
 * Production V1 final 鈫?V2 draft Session wire (Intake reaggregation).
 * Persist via C1 commitDecisionContextChange 鈥?same SoT as Freeze.
 */

import type { POJUSessionState } from "@/lib/poju/types";
import { buildProductionNaValidationContextFromSession } from "./na-validation-from-session";
import { applyDcToWorking } from "./persist";
import {
  startV2FromFinal,
  type StartV2Options,
  type StartV2Result,
  VersioningError,
} from "./versioning";
import type { DecisionContext } from "./types";

export type ApplyV2Result = StartV2Result & {
  session: POJUSessionState;
};

export type PersistV2Result =
  | {
      ok: true;
      skipped?: false;
      session: POJUSessionState;
      superseded: DecisionContext;
      draft: DecisionContext;
      idempotency_key: string;
    }
  | {
      ok: true;
      skipped: true;
      reason: "idempotent_skip" | "not_final";
      session: POJUSessionState;
    }
  | {
      ok: false;
      reason: string;
      session: POJUSessionState;
    };

export type StartV2OnSessionOpts = Omit<
  StartV2Options,
  "naValidation" | "expectedSessionId"
>;

/**
 * Pure: open V2 draft on Session using the production NaValidationContext
 * (Session authority + ACTIVE DIR catalog; no caller authority entry).
 */
export async function applyV2FromFinalToSession(
  session: POJUSessionState,
  opts: StartV2OnSessionOpts = {},
): Promise<ApplyV2Result> {
  const finalDc = session.decision_context;
  if (!finalDc || finalDc.status !== "final") {
    throw new VersioningError(
      `applyV2FromFinalToSession requires final DC, got ${finalDc?.status ?? "missing"}`,
    );
  }

  const naValidation = await buildProductionNaValidationContextFromSession(session, { nowIso: opts.now });

  const { superseded, draft } = startV2FromFinal(finalDc, {
    ...opts,
    naValidation,
    expectedSessionId: session.session_id,
  });

  const versions = [...(session.decision_context_versions ?? [])];
  const hasV1 = versions.some(
    (v) =>
      v.context_id === superseded.context_id && v.version === superseded.version,
  );
  // Keep immutable V1 final snapshot in versions; also record superseded marker row.
  if (!hasV1) {
    versions.push({
      ...finalDc,
      reality_facts: finalDc.reality_facts.map((f) => ({ ...f })),
      constraints: finalDc.constraints.map((c) => ({ ...c })),
      hypotheses: finalDc.hypotheses.map((h) => ({ ...h })),
      dirs: finalDc.dirs.map((d) => ({ ...d })),
      conflicts: finalDc.conflicts.map((c) => ({ ...c })),
      definition: { ...finalDc.definition },
    });
  } else {
    // Mark existing V1 snapshot superseded without rewriting content_hash.
    for (let i = 0; i < versions.length; i++) {
      const v = versions[i]!;
      if (
        v.context_id === superseded.context_id &&
        v.version === superseded.version &&
        v.status === "final"
      ) {
        versions[i] = {
          ...v,
          status: "superseded",
          content_hash: v.content_hash,
          superseded_by: superseded.superseded_by,
          updated_at: superseded.updated_at,
        };
      }
    }
  }

  return {
    superseded,
    draft,
    session: {
      ...session,
      decision_context: draft,
      decision_context_versions: versions,
    },
  };
}

export function v2IdempotencyKey(
  session: POJUSessionState,
  finalDc: DecisionContext,
  nextVersion: number,
): string {
  return `dc_v2:${session.session_id}:${finalDc.context_id}:v${finalDc.version}->${nextVersion}`;
}

/**
 * Persist V2 open through Session C1. Idempotent on version key.
 */
export async function persistV2FromFinalOnSession(
  session: POJUSessionState,
  opts: StartV2OnSessionOpts & { operation_id?: string } = {},
): Promise<PersistV2Result> {
  const finalDc = session.decision_context;
  if (!finalDc || finalDc.status !== "final") {
    return { ok: true, skipped: true, reason: "not_final", session };
  }

  let applied: ApplyV2Result;
  try {
    applied = await applyV2FromFinalToSession(session, opts);
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
      session,
    };
  }

  const idempotency_key =
    opts.operation_id?.trim() ||
    v2IdempotencyKey(session, finalDc, applied.draft.version);

  const { commitDecisionContextChange } = await import(
    "@/lib/poju/session-manager"
  );
  const commit = await commitDecisionContextChange({
    session,
    idempotency_key,
    now: opts.now,
    // V2 open is DC-authority; do not require control-plane presence.
    require_control_plane: false,
    apply: (tx) => {
      applyDcToWorking(
        tx,
        applied.draft,
        applied.session.decision_context_versions ?? [],
      );
    },
  });

  if (commit.idempotent_skip) {
    return {
      ok: true,
      skipped: true,
      reason: "idempotent_skip",
      session: commit.session,
    };
  }
  if (!commit.committed) {
    return {
      ok: false,
      reason: commit.error ?? "dc_v2_persist_failed",
      session,
    };
  }
  return {
    ok: true,
    session: commit.session,
    superseded: applied.superseded,
    draft: applied.draft,
    idempotency_key,
  };
}



