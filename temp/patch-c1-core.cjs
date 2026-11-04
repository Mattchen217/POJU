/**
 * Phase 3 rem C1 — fold renewals into Session CAS write + rewrite extend + tests.
 */
const fs = require("fs");
const path = require("path");

function mustReplace(src, from, to, label) {
  if (!src.includes(from)) {
    throw new Error(`PATCH FAIL (${label}): anchor not found:\n${from.slice(0, 200)}`);
  }
  const out = src.replace(from, to);
  if (out === src) throw new Error(`PATCH FAIL (${label}): replace no-op`);
  return out;
}

function mustReplaceOnce(src, from, to, label) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error(`PATCH FAIL (${label}): anchor not found:\n${from.slice(0, 200)}`);
  const j = src.indexOf(from, i + 1);
  if (j >= 0) throw new Error(`PATCH FAIL (${label}): anchor not unique`);
  return src.slice(0, i) + to + src.slice(i + from.length);
}

// ---------- session-mutation.ts ----------
{
  const p = "lib/poju/session-mutation.ts";
  let s = fs.readFileSync(p, "utf8");

  s = mustReplaceOnce(
    s,
    `  generation_base_revision?: number;
}

export class SessionCasError extends Error {`,
    `  generation_base_revision?: number;
  /**
   * Phase 3 C1 — optional non-blob row column written in the SAME Dexie CAS
   * update as encrypted_data / revision mirrors / expires_at. Not a second
   * Session write authority: renewals are folded into casWritePOJUSession.
   * Applied inside the txn from the latest row (idempotent by payment_id).
   */
  append_renewal?: {
    extended_at: Date;
    reason: string;
    payment_id?: string;
  };
}

export class SessionCasError extends Error {`,
    "SessionMutation.append_renewal",
  );

  s = mustReplaceOnce(
    s,
    `  testStagedPreBinding?: {
    candidate: POJUSessionState;
    afterWrite?: () => void | Promise<void>;
  };
}`,
    `  testStagedPreBinding?: {
    candidate: POJUSessionState;
    afterWrite?: () => void | Promise<void>;
  };
  /**
   * Phase 3 C1 — fold renewals into the single Dexie CAS update (same txn as
   * encrypted_data). Idempotent by payment_id against the row read inside txn.
   */
  append_renewal?: {
    extended_at: Date;
    reason: string;
    payment_id?: string;
  };
}`,
    "CasWritePOJUSessionInput.append_renewal",
  );

  s = mustReplaceOnce(
    s,
    `    const updated = await db.pojuSessionRecords.update(sessionId, {
      encrypted_data: payload.cipher,
      iv: payload.iv,
      session_revision: nextSessionRevision,
      dc_write_revision: nextDcWriteRevision,
      original_question: committedState.original_question.trim(),
      last_interaction_at: lastInteraction,
      expires_at: expiresAt,
      tokens_used: committedState.tokens_used,
      turn_count: turnCount,
      current_state_hint: hint,
      main_delivery_done: committedState.main_delivery_done,
      main_delivery_at: committedState.main_delivery_done ? new Date() : undefined,
      active_cycle_id: committedState.active_cycle_id,
    });`,
    `    // Phase 3 C1 — renewals (payment audit) share this update with the blob.
    // Computed from the in-txn row so CAS retries stay idempotent by payment_id.
    let nextRenewals: POJUSessionRecord["renewals"] | undefined;
    if (input.append_renewal) {
      const existing = Array.isArray(row.renewals) ? row.renewals : [];
      const payId = input.append_renewal.payment_id?.trim();
      const already =
        !!payId && existing.some((r) => r.payment_id && r.payment_id === payId);
      nextRenewals = already
        ? existing
        : [
            ...existing,
            {
              extended_at: input.append_renewal.extended_at,
              reason: input.append_renewal.reason,
              ...(payId ? { payment_id: payId } : {}),
            },
          ];
    }

    const updated = await db.pojuSessionRecords.update(sessionId, {
      encrypted_data: payload.cipher,
      iv: payload.iv,
      session_revision: nextSessionRevision,
      dc_write_revision: nextDcWriteRevision,
      original_question: committedState.original_question.trim(),
      last_interaction_at: lastInteraction,
      expires_at: expiresAt,
      tokens_used: committedState.tokens_used,
      turn_count: turnCount,
      current_state_hint: hint,
      main_delivery_done: committedState.main_delivery_done,
      main_delivery_at: committedState.main_delivery_done ? new Date() : undefined,
      active_cycle_id: committedState.active_cycle_id,
      ...(nextRenewals !== undefined ? { renewals: nextRenewals } : {}),
    });`,
    "casWrite final update renewals",
  );

  s = mustReplaceOnce(
    s,
    `    if (JSON.stringify(stripRevs(candidate)) === JSON.stringify(stripRevs(base))) {
      return {
        state: base,
        session_revision: mirror.session_revision,
        dc_write_revision: mirror.dc_write_revision,
      };
    }`,
    `    if (JSON.stringify(stripRevs(candidate)) === JSON.stringify(stripRevs(base))) {
      // C1 recovery: blob content may already match while renewals still need the
      // payment_id (legacy split left blob OK / metadata missing). Fall through
      // so append_renewal can still commit in the same CAS update.
      const payId = mutation.append_renewal?.payment_id?.trim();
      const renewalPending =
        !!payId &&
        !(loaded.row.renewals ?? []).some(
          (r) => r.payment_id && r.payment_id === payId,
        );
      if (!renewalPending) {
        return {
          state: base,
          session_revision: mirror.session_revision,
          dc_write_revision: mirror.dc_write_revision,
        };
      }
    }`,
    "mutate no-op renewals gate",
  );

  s = mustReplaceOnce(
    s,
    `      return await write({
        candidate,
        expected_session_revision: mirror.session_revision,
        expected_dc_write_revision: mirror.dc_write_revision,
        bump_dc_write_revision: bumpDc,
        ...(mutation.generation_base_revision !== undefined
          ? { generation_base_revision: mutation.generation_base_revision }
          : {}),
        ...(opts.encrypt ? { encrypt: opts.encrypt } : {}),
        ...(opts.cycleSync ? { cycleSync: opts.cycleSync } : {}),
      });`,
    `      return await write({
        candidate,
        expected_session_revision: mirror.session_revision,
        expected_dc_write_revision: mirror.dc_write_revision,
        bump_dc_write_revision: bumpDc,
        ...(mutation.generation_base_revision !== undefined
          ? { generation_base_revision: mutation.generation_base_revision }
          : {}),
        ...(mutation.append_renewal
          ? { append_renewal: mutation.append_renewal }
          : {}),
        ...(opts.encrypt ? { encrypt: opts.encrypt } : {}),
        ...(opts.cycleSync ? { cycleSync: opts.cycleSync } : {}),
      });`,
    "mutate pass append_renewal",
  );

  fs.writeFileSync(p, s);
  console.log("patched", p);
}

// ---------- session-manager.ts extend ----------
{
  const p = "lib/poju/session-manager.ts";
  let s = fs.readFileSync(p, "utf8");

  s = mustReplaceOnce(
    s,
    `import {
  casWritePOJUSessionFromCandidate,
  createPOJUSessionRecordIfAbsent,
  resolveRevisionMirror,
  SessionCasError,
  SESSION_CREATE_EXISTS,
} from "@/lib/poju/session-mutation";`,
    `import {
  casWritePOJUSessionFromCandidate,
  createPOJUSessionRecordIfAbsent,
  mutatePOJUSession,
  resolveRevisionMirror,
  SessionCasError,
  SESSION_CREATE_EXISTS,
} from "@/lib/poju/session-mutation";`,
    "import mutatePOJUSession",
  );

  s = mustReplaceOnce(
    s,
    `/** Extend active session by 30 days after a paid renewal. */
export async function extendPOJUV4Session(
  sessionId: string,
  paymentId: string,
): Promise<POJUSessionState | null> {
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(sessionId);
  const state = await loadPOJUSession(sessionId);
  if (!row || !state || row.status !== "active") return null;
  if (!isRowOwnedBy(row, ownerKey)) return null;
  if (getPojuDeviceId() !== state.device_id) return null;
  if (!paymentId.trim()) return null;

  const now = new Date();
  const exp = new Date(now.getTime() + THIRTY_DAYS_MS);
  const next: POJUSessionState = {
    ...state,
    expires_at: exp.toISOString(),
    last_interaction_at: now.toISOString(),
  };

  // Phase 3 S1 open item C1 — metadata vs blob keep separate atomicity boundaries
  // (S0 inventory C1 option a; Contract/Mapping do not prescribe folding renewals
  // into a single blob CAS). Metadata columns updated here WITHOUT encrypted_data;
  // blob expiry mirror goes through savePOJUSession → unified CAS.
  await db.pojuSessionRecords.update(sessionId, {
    expires_at: exp,
    last_interaction_at: now,
    renewals: [
      ...row.renewals,
      { extended_at: now, reason: "paid_extension", payment_id: paymentId.trim() },
    ],
  });

  await savePOJUSession(next);
  return next;
}`,
    `/**
 * Extend active session by 30 days after a paid renewal.
 *
 * Phase 3 C1 — unified Session CAS write: blob expires_at / last_interaction_at
 * and row renewals share one Dexie update inside casWritePOJUSession (via
 * mutatePOJUSession.append_renewal). Not a second write authority.
 *
 * Failure modes (honest atomicity claim):
 * - Encrypt fail before txn → neither blob nor renewals change.
 * - Mid-txn abort (e.g. cycle index) → Dexie rolls back blob + renewals together.
 * - Legacy split residue: same payment_id is idempotent; missing renewals with
 *   already-extended blob still appends renewals (mutate no-op gate).
 */
export async function extendPOJUV4Session(
  sessionId: string,
  paymentId: string,
): Promise<POJUSessionState | null> {
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(sessionId);
  const state = await loadPOJUSession(sessionId);
  if (!row || !state || row.status !== "active") return null;
  if (!isRowOwnedBy(row, ownerKey)) return null;
  if (getPojuDeviceId() !== state.device_id) return null;
  if (!paymentId.trim()) return null;

  const payId = paymentId.trim();
  const now = new Date();
  const exp = new Date(now.getTime() + THIRTY_DAYS_MS);
  const nowIso = now.toISOString();
  const expIso = exp.toISOString();

  const result = await mutatePOJUSession(sessionId, {
    operation_id: \`extend_paid_\${payId}\`,
    kind: "session_patch",
    bump_dc: false,
    append_renewal: {
      extended_at: now,
      reason: "paid_extension",
      payment_id: payId,
    },
    apply: (latest) => ({
      ...latest,
      expires_at: expIso,
      last_interaction_at: nowIso,
    }),
  });

  // Post-commit side effects (archive/profile) — same rule as savePOJUSession:
  // failures must not roll back the already-committed core CAS write.
  await runPOJUSessionPostCommitSideEffects(result.state);
  return result.state;
}`,
    "rewrite extendPOJUV4Session",
  );

  fs.writeFileSync(p, s);
  console.log("patched", p);
}

console.log("core patches done");
