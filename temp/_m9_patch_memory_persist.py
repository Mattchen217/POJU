from pathlib import Path

p = Path(r"D:\POJU\pojulife\lib\poju\session-mutation.ts")
text = p.read_text(encoding="utf-8")
if 'runWithMemorySessionPersist' in text:
    print("already patched mutation")
else:
    text = text.replace(
        'import { encryptJson, decryptJson } from "@/lib/crypto";\n',
        'import { AsyncLocalStorage } from "node:async_hooks";\n\nimport { encryptJson, decryptJson } from "@/lib/crypto";\n',
        1,
    )
    hook = '''
type MemorySessionPersistFrame = {
  sessions: Map<string, POJUSessionState>;
};

const memorySessionPersistAls = new AsyncLocalStorage<MemorySessionPersistFrame>();

/** Server-authoritative chat: apply Session CAS in memory; the server record is the persist. */
export function runWithMemorySessionPersist<T>(
  seed: POJUSessionState | POJUSessionState[],
  fn: () => T | Promise<T>,
): Promise<T> {
  const sessions = new Map<string, POJUSessionState>();
  for (const state of Array.isArray(seed) ? seed : [seed]) {
    sessions.set(state.session_id, JSON.parse(JSON.stringify(state)) as POJUSessionState);
  }
  return Promise.resolve(memorySessionPersistAls.run({ sessions }, fn));
}

function memoryPersistedSession(sessionId: string): POJUSessionState | undefined {
  return memorySessionPersistAls.getStore()?.sessions.get(sessionId);
}

function writeMemoryPersistedSession(state: POJUSessionState): void {
  memorySessionPersistAls.getStore()?.sessions.set(state.session_id, state);
}

function isMemorySessionPersistActive(): boolean {
  return memorySessionPersistAls.getStore() != null;
}

function memorySessionRow(state: POJUSessionState): POJUSessionRecord {
  return {
    session_id: state.session_id,
    device_id: state.device_id,
    owner_key: "memory-session-authority",
    encrypted_data: "",
    iv: "",
    session_revision: state.session_revision ?? 0,
    dc_write_revision: state.dc_write_revision ?? 0,
    status: "active",
    original_question: state.original_question,
    created_at: new Date(state.created_at),
    last_interaction_at: new Date(state.last_interaction_at),
    expires_at: new Date(state.expires_at),
    payment_id: "memory-session-authority",
    payment_processor: "dodopayments",
    renewals: [],
    tokens_used: state.tokens_used,
    turn_count: countUserTurns(state),
    current_state_hint: "opening",
    main_delivery_done: state.main_delivery_done,
    active_cycle_id: state.active_cycle_id,
  };
}

'''
    text = text.replace(
        'const SESSION_SECRET = "pojulife_v4_poju_session"; // legacy encryptJson arg; not a security boundary\n',
        'const SESSION_SECRET = "pojulife_v4_poju_session"; // legacy encryptJson arg; not a security boundary\n' + hook,
        1,
    )

    # casWritePOJUSession: after computing committedState, short-circuit memory persist
    needle = '''  const committedState: POJUSessionState = {
    ...input.candidate,
    session_revision: nextSessionRevision,
    dc_write_revision: nextDcWriteRevision,
  };

  // §7.5 step 6 — encrypt OUTSIDE the Dexie transaction
'''
    repl = '''  const committedState: POJUSessionState = {
    ...input.candidate,
    session_revision: nextSessionRevision,
    dc_write_revision: nextDcWriteRevision,
  };

  if (isMemorySessionPersistActive()) {
    const current = memoryPersistedSession(sessionId);
    const currentRev = current?.session_revision ?? 0;
    if (current && currentRev !== input.expected_session_revision) {
      throw new SessionCasError(
        SESSION_CAS_CONFLICT,
        `memory persist stale revision=${input.expected_session_revision} latest=${currentRev}`,
      );
    }
    writeMemoryPersistedSession(committedState);
    return {
      state: committedState,
      session_revision: nextSessionRevision,
      dc_write_revision: nextDcWriteRevision,
    };
  }

  // §7.5 step 6 — encrypt OUTSIDE the Dexie transaction
'''
    if needle not in text:
        raise SystemExit("casWrite committedState needle not found")
    text = text.replace(needle, repl, 1)

    # defaultLoad
    load_needle = '''async function defaultLoad(
  sessionId: string,
): Promise<{ row: POJUSessionRecord; state: POJUSessionState } | null> {
  const db = getPojuDb();
'''
    load_repl = '''async function defaultLoad(
  sessionId: string,
): Promise<{ row: POJUSessionRecord; state: POJUSessionState } | null> {
  if (isMemorySessionPersistActive()) {
    const state = memoryPersistedSession(sessionId);
    if (!state) return null;
    const row = memorySessionRow(state);
    resolveRevisionMirror(row, state);
    return { row, state };
  }
  const db = getPojuDb();
'''
    if load_needle not in text:
        raise SystemExit("defaultLoad needle not found")
    text = text.replace(load_needle, load_repl, 1)

    # casWritePOJUSessionFromCandidate
    cand_needle = '''  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(candidate.session_id);
  if (!row || !isRowOwnedBy(row, ownerKey)) {
    throw new Error(
      `pojuSessionRecords.update expected 1 row, got 0 (session_id=${candidate.session_id})`,
    );
  }
  const blob = await decryptJson<POJUSessionState>(SESSION_SECRET, {
    iv: row.iv,
    cipher: row.encrypted_data,
  });
  const mirror = resolveRevisionMirror(row, blob);
'''
    cand_repl = '''  if (isMemorySessionPersistActive()) {
    const blob = memoryPersistedSession(candidate.session_id) ?? candidate;
    const mirror = {
      session_revision: blob.session_revision ?? 0,
      dc_write_revision: blob.dc_write_revision ?? 0,
    };
    if (
      candidate.session_revision !== undefined &&
      candidate.session_revision !== null &&
      candidate.session_revision !== mirror.session_revision
    ) {
      throw new SessionCasError(
        SESSION_CAS_CONFLICT,
        `stale candidate session_revision=${candidate.session_revision} latest=${mirror.session_revision}`,
      );
    }
    const bumpPolicy = opts?.bump_dc ?? "auto";
    const baseForDc: POJUSessionState = {
      ...blob,
      session_revision: mirror.session_revision,
      dc_write_revision: mirror.dc_write_revision,
    };
    await syncDcLedgerBeforeWrite({
      base: baseForDc,
      candidate,
      idempotency_key: opts?.dc_ledger_idempotency_key ?? contentDerivedLedgerKey(candidate),
    });
    const bumpDc =
      bumpPolicy === true
        ? true
        : bumpPolicy === false
          ? false
          : didDecisionContextChange(baseForDc, candidate);
    const result = await casWritePOJUSession({
      candidate,
      expected_session_revision: mirror.session_revision,
      expected_dc_write_revision: mirror.dc_write_revision,
      bump_dc_write_revision: bumpDc,
    });
    candidate.session_revision = result.session_revision;
    candidate.dc_write_revision = result.dc_write_revision;
    return result;
  }

  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(candidate.session_id);
  if (!row || !isRowOwnedBy(row, ownerKey)) {
    throw new Error(
      `pojuSessionRecords.update expected 1 row, got 0 (session_id=${candidate.session_id})`,
    );
  }
  const blob = await decryptJson<POJUSessionState>(SESSION_SECRET, {
    iv: row.iv,
    cipher: row.encrypted_data,
  });
  const mirror = resolveRevisionMirror(row, blob);
'''
    if cand_needle not in text:
        raise SystemExit("fromCandidate needle not found")
    text = text.replace(cand_needle, cand_repl, 1)
    p.write_text(text, encoding="utf-8", newline="\n")
    print("patched session-mutation.ts")

# Wrap handleUserMessage in chat.ts
c = Path(r"D:\POJU\pojulife\lib\poju\session-authority\chat.ts")
ct = c.read_text(encoding="utf-8")
if "runWithMemorySessionPersist" not in ct:
    ct = ct.replace(
        'import { handleUserMessage } from "@/lib/poju/agent";\n',
        'import { handleUserMessage } from "@/lib/poju/agent";\nimport { runWithMemorySessionPersist } from "@/lib/poju/session-mutation";\n',
        1,
    )
    ct = ct.replace(
        "    sessionOut = await runWithLlmCapture(capture, () =>\n      handleUserMessage({\n",
        "    sessionOut = await runWithMemorySessionPersist(boundSession, () =>\n      runWithLlmCapture(capture, () =>\n        handleUserMessage({\n",
        1,
    )
    # close the extra paren
    old = '''        server_invoke: {
          base_analysis: body.base_analysis === undefined ? null : body.base_analysis,
          profile: body.profile ?? body.userProfile ?? null,
        },
      }),
    );
'''
    new = '''        server_invoke: {
          base_analysis: body.base_analysis === undefined ? null : body.base_analysis,
          profile: body.profile ?? body.userProfile ?? null,
        },
      }),
      ),
    );
'''
    if old not in ct:
        raise SystemExit("handleUserMessage close not found")
    ct = ct.replace(old, new, 1)
    c.write_text(ct, encoding="utf-8", newline="\n")
    print("patched chat.ts memory persist wrap")
else:
    print("chat.ts already wrapped")