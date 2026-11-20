const fs = require("fs");
const path = "lib/poju/decision-intake/freeze-bound-report.ts";
let s = fs.readFileSync(path, "utf8");

const oldPrepare = `/**
 * M2.2 → formal final-delivery bridge:
 * Load authoritative Freeze → FrozenReportSnapshot → persist Freeze-bound job
 * → return DC fields for FinalDeliveryJobInput (existing eight-page LLM path).
 * Does not invent a second report pipeline.
 */
export async function prepareFreezeBoundFinalDelivery(input: {
  session: POJUSessionState;
  freezeId?: string;
  context_id?: string;
  version?: number;
  expected_hash?: string;
  reportSchemaVersion?: string;
  deps?: FreezeBoundReportDeps;
}): Promise<
  | {
      ok: true;
      snapshot: FrozenReportSnapshot;
      job: FreezeBoundReportJob;
      session: POJUSessionState;
      decision_context_snapshot: DecisionContext;
      decision_context_binding: DecisionContextBinding;
      require_decision_context: true;
    }
  | { ok: false; code: string; error: string; session: POJUSessionState }
> {
  let snapshot: FrozenReportSnapshot;
  try {
    const loaded = loadAuthoritativeFreeze(input.session, {
      freezeId: input.freezeId,
      context_id: input.context_id,
      version: input.version,
      expected_hash: input.expected_hash,
    });
    snapshot = createFrozenReportSnapshot({
      sessionId: input.session.session_id,
      frozen: loaded.frozen,
      binding: loaded.binding,
      reportSchemaVersion:
        input.reportSchemaVersion ?? M22_REPORT_SCHEMA_VERSION,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e instanceof FreezeBoundReportError
        ? e.code
        : e instanceof DcReportBindError
          ? e.code
          : "FREEZE_LOAD_FAILED";
    return { ok: false, code, error: msg, session: input.session };
  }

  try {
    const created = await createOrGetReportJob({
      session: input.session,
      snapshot,
      deps: input.deps,
    });
    return {
      ok: true,
      snapshot,
      job: created.job,
      session: created.session,
      decision_context_snapshot: snapshot.decisionContext as DecisionContext,
      decision_context_binding: snapshot.binding,
      require_decision_context: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e instanceof FreezeBoundReportError ? e.code : "JOB_CREATE_FAILED";
    return { ok: false, code, error: msg, session: input.session };
  }
}`;

const newPrepare = `/**
 * M2.2 → formal final-delivery bridge:
 * Load authoritative Freeze → FrozenReportSnapshot → persist Freeze-bound job
 * → return DC fields for FinalDeliveryJobInput (existing eight-page LLM path).
 * Does not invent a second report pipeline.
 *
 * When \`acquireGenerationClaim\` is true (production Final Delivery path):
 * acquire the shared KV claim BEFORE job create; only the claim owner may
 * proceed to start generation. Caller MUST release via releaseFreezeBoundReportClaim
 * on completion/failure (token-checked CAS delete).
 */
export async function prepareFreezeBoundFinalDelivery(input: {
  session: POJUSessionState;
  freezeId?: string;
  context_id?: string;
  version?: number;
  expected_hash?: string;
  reportSchemaVersion?: string;
  deps?: FreezeBoundReportDeps;
  /** Production Final Delivery: claim before create/start; hold until complete/fail. */
  acquireGenerationClaim?: boolean;
}): Promise<
  | {
      ok: true;
      snapshot: FrozenReportSnapshot;
      job: FreezeBoundReportJob;
      session: POJUSessionState;
      decision_context_snapshot: DecisionContext;
      decision_context_binding: DecisionContextBinding;
      require_decision_context: true;
      claimHeld: boolean;
      claimToken: string | null;
      claimKey: string | null;
      reusedCompleted: boolean;
    }
  | {
      ok: false;
      code: string;
      error: string;
      session: POJUSessionState;
      job?: FreezeBoundReportJob | null;
    }
> {
  let snapshot: FrozenReportSnapshot;
  try {
    const loaded = loadAuthoritativeFreeze(input.session, {
      freezeId: input.freezeId,
      context_id: input.context_id,
      version: input.version,
      expected_hash: input.expected_hash,
    });
    snapshot = createFrozenReportSnapshot({
      sessionId: input.session.session_id,
      frozen: loaded.frozen,
      binding: loaded.binding,
      reportSchemaVersion:
        input.reportSchemaVersion ?? M22_REPORT_SCHEMA_VERSION,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e instanceof FreezeBoundReportError
        ? e.code
        : e instanceof DcReportBindError
          ? e.code
          : "FREEZE_LOAD_FAILED";
    return { ok: false, code, error: msg, session: input.session };
  }

  const key = buildReportIdempotencyKey({
    sessionId: snapshot.sessionId,
    freezeId: snapshot.freezeId,
    reportSchemaVersion: snapshot.reportSchemaVersion,
  });
  const claimKey = freezeReportClaimKey({
    sessionId: snapshot.sessionId,
    freezeId: snapshot.freezeId,
    reportSchemaVersion: snapshot.reportSchemaVersion,
  });
  const claimOps = input.deps?.claimOps ?? defaultProcessLocalClaimOps;
  const claimTtl = input.deps?.claimTtlSec ?? M22_REPORT_CLAIM_TTL_SEC;

  let session = input.session;
  if (input.deps?.loadSession) {
    const fresh = await input.deps.loadSession(session.session_id);
    if (fresh) session = fresh;
  }

  const existing = findJobByKey(session, key);
  if (existing?.status === "completed") {
    return {
      ok: true,
      snapshot,
      job: existing,
      session,
      decision_context_snapshot: snapshot.decisionContext as DecisionContext,
      decision_context_binding: snapshot.binding,
      require_decision_context: true,
      claimHeld: false,
      claimToken: null,
      claimKey: null,
      reusedCompleted: true,
    };
  }

  let claimToken: string | null = null;
  let claimHeld = false;
  if (input.acquireGenerationClaim) {
    claimToken = newFreezeReportClaimToken();
    const acquired = await claimOps.tryAcquire(
      claimKey,
      claimToken,
      claimTtl,
      existing ? { job_id: existing.job_id } : undefined,
    );
    if (!acquired) {
      if (input.deps?.loadSession) {
        const fresh = await input.deps.loadSession(session.session_id);
        if (fresh) session = fresh;
      }
      const heldJob = findJobByKey(session, key);
      if (heldJob?.status === "completed") {
        return {
          ok: true,
          snapshot,
          job: heldJob,
          session,
          decision_context_snapshot: snapshot.decisionContext as DecisionContext,
          decision_context_binding: snapshot.binding,
          require_decision_context: true,
          claimHeld: false,
          claimToken: null,
          claimKey: null,
          reusedCompleted: true,
        };
      }
      return {
        ok: false,
        code: "GENERATION_IN_PROGRESS",
        error: \`Freeze-bound report claim held for \${claimKey}; not starting another generator\`,
        job: heldJob ?? null,
        session,
      };
    }
    claimHeld = true;
  }

  try {
    if (input.deps?.loadSession && claimHeld) {
      const fresh = await input.deps.loadSession(session.session_id);
      if (fresh) session = fresh;
    }
    const raced = findJobByKey(session, key);
    if (raced?.status === "completed") {
      if (claimHeld && claimToken) {
        await claimOps.release(claimKey, claimToken).catch(() => undefined);
        claimHeld = false;
        claimToken = null;
      }
      return {
        ok: true,
        snapshot,
        job: raced,
        session,
        decision_context_snapshot: snapshot.decisionContext as DecisionContext,
        decision_context_binding: snapshot.binding,
        require_decision_context: true,
        claimHeld: false,
        claimToken: null,
        claimKey: null,
        reusedCompleted: true,
      };
    }

    const created = await createOrGetReportJob({
      session,
      snapshot,
      deps: input.deps,
    });
    return {
      ok: true,
      snapshot,
      job: created.job,
      session: created.session,
      decision_context_snapshot: snapshot.decisionContext as DecisionContext,
      decision_context_binding: snapshot.binding,
      require_decision_context: true,
      claimHeld,
      claimToken: claimHeld ? claimToken : null,
      claimKey: claimHeld ? claimKey : null,
      reusedCompleted: false,
    };
  } catch (e) {
    if (claimHeld && claimToken) {
      await claimOps.release(claimKey, claimToken).catch(() => undefined);
    }
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e instanceof FreezeBoundReportError ? e.code : "JOB_CREATE_FAILED";
    return { ok: false, code, error: msg, session };
  }
}

/** Token-checked compare-and-delete release for a held Final Delivery claim. */
export async function releaseFreezeBoundReportClaim(input: {
  claimKey: string;
  claimToken: string;
  deps?: FreezeBoundReportDeps;
}): Promise<boolean> {
  const claimOps = input.deps?.claimOps ?? defaultProcessLocalClaimOps;
  const result = await claimOps.release(input.claimKey, input.claimToken);
  return result !== false;
}

/**
 * Mark the Freeze-bound report job failed/retryable (never completed).
 * Preserves original Freeze binding.
 */
export async function failFreezeBoundReportJob(input: {
  session: POJUSessionState;
  jobId: string;
  error: string;
  deps?: FreezeBoundReportDeps;
}): Promise<{ session: POJUSessionState; job: FreezeBoundReportJob | null }> {
  const now = input.deps?.now?.() ?? new Date().toISOString();
  const job = jobsOf(input.session).find((j) => j.job_id === input.jobId);
  if (!job) return { session: input.session, job: null };
  if (job.status === "completed") {
    return { session: input.session, job };
  }
  const next: FreezeBoundReportJob = {
    ...job,
    status: "failed",
    updated_at: now,
    error: input.error,
  };
  let session = upsertJob(input.session, next);
  if (input.deps?.persistSession) await input.deps.persistSession(session);
  return { session, job: next };
}`;

if (!s.includes(oldPrepare)) {
  throw new Error("prepareFreezeBoundFinalDelivery block not found");
}
s = s.replace(oldPrepare, newPrepare);
fs.writeFileSync(path, s);
console.log("prepareFreezeBoundFinalDelivery patched");
