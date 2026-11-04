const fs = require("fs");

function mustReplace(path, oldStr, newStr, label) {
  const s = fs.readFileSync(path, "utf8");
  if (!s.includes(oldStr)) {
    console.error("NOT FOUND:", label);
    process.exit(1);
  }
  const count = s.split(oldStr).length - 1;
  if (count !== 1) {
    console.error("EXPECTED 1 occurrence, got", count, "for", label);
    process.exit(1);
  }
  fs.writeFileSync(path, s.replace(oldStr, newStr));
  console.log("OK:", label);
}

// Fix 1: savePOJUSessionCore update count check
mustReplace(
  "lib/poju/session-manager.ts",
  `  const run = async () => {
    await db.pojuSessionRecords.update(state.session_id, {
      encrypted_data: payload.cipher,
      iv: payload.iv,
      original_question: state.original_question.trim(),
      last_interaction_at: lastInteraction,
      expires_at: expiresAt,
      tokens_used: state.tokens_used,
      turn_count: turnCount,
      current_state_hint: hint,
      main_delivery_done: state.main_delivery_done,
      main_delivery_at: state.main_delivery_done ? new Date() : undefined,
      active_cycle_id: state.active_cycle_id,
    });
    await syncSessionCyclesToDbWithDb(db, state, ownerKey);
  };`,
  `  const run = async () => {
    const updated = await db.pojuSessionRecords.update(state.session_id, {
      encrypted_data: payload.cipher,
      iv: payload.iv,
      original_question: state.original_question.trim(),
      last_interaction_at: lastInteraction,
      expires_at: expiresAt,
      tokens_used: state.tokens_used,
      turn_count: turnCount,
      current_state_hint: hint,
      main_delivery_done: state.main_delivery_done,
      main_delivery_at: state.main_delivery_done ? new Date() : undefined,
      active_cycle_id: state.active_cycle_id,
    });
    // Dexie update returns modified count; 0 means missing row — throw so the
    // surrounding transaction rolls back cycle-index writes too (C1 atomicity).
    if (updated !== 1) {
      throw new Error(
        \`pojuSessionRecords.update expected 1 row, got \${updated} (session_id=\${state.session_id})\`,
      );
    }
    await syncSessionCyclesToDbWithDb(db, state, ownerKey);
  };`,
  "savePOJUSessionCore update check",
);

// Fix 2: remove pre-save rename plaintext update
mustReplace(
  "components/poju/POJUChatUI.tsx",
  `  async function handleRenameSession(targetSessionId: string, newTitle: string) {
    const value = newTitle.trim();
    if (!value) return;

    await getPojuDb().pojuSessionRecords.update(targetSessionId, { original_question: value });
    const state = await loadPOJUSession(targetSessionId);
    if (state) {
      // loadPOJUSession already applied DC restore authority.
      const next = { ...state, original_question: value };
      if (targetSessionId === sessionRef.current.session_id) {
        // C1: confirm UI memory only after core blob+cycle persist succeeds.
        await confirmSessionAfterCorePersist(next, onSessionUpdate);
      } else {
        await savePOJUSessionCore(next);
        void runPOJUSessionPostCommitSideEffects(next);
      }
    }
    setSessionRows((prev) =>
      prev.map((x) => (x.session_id === targetSessionId ? { ...x, original_question: value } : x)),
    );
  }`,
  `  async function handleRenameSession(targetSessionId: string, newTitle: string) {
    const value = newTitle.trim();
    if (!value) return;

    // Rename must commit only through savePOJUSessionCore (C1): plaintext index
    // + encrypted blob stay consistent — no independent pre-save index update.
    const state = await loadPOJUSession(targetSessionId);
    if (state) {
      // loadPOJUSession already applied DC restore authority.
      const next = { ...state, original_question: value };
      if (targetSessionId === sessionRef.current.session_id) {
        // C1: confirm UI memory only after core blob+cycle persist succeeds.
        await confirmSessionAfterCorePersist(next, onSessionUpdate);
      } else {
        await savePOJUSessionCore(next);
        void runPOJUSessionPostCommitSideEffects(next);
      }
    }
    setSessionRows((prev) =>
      prev.map((x) => (x.session_id === targetSessionId ? { ...x, original_question: value } : x)),
    );
  }`,
  "handleRenameSession unify write path",
);

// Fix 3: writeCycleIndexRows empty cleanup + syncSessionCyclesToDb early-return
mustReplace(
  "lib/poju/cycle-db-sync.ts",
  `async function writeCycleIndexRows(
  db: PojuDb,
  state: POJUSessionState,
  ownerKey: string,
): Promise<void> {
  const cycles = state.cycles;
  if (!cycles?.length) return;

  const sessionId = state.session_id;
  const deviceId = state.device_id;

  await db.poju_cycles.where("session_id").equals(sessionId).delete();

  const rows = cycles.map((c) => ({
    cycle_id: c.cycle_id,
    session_id: sessionId,
    device_id: deviceId,
    owner_key: ownerKey,
    cycle_index: c.cycle_index,
    is_active: c.cycle_id === state.active_cycle_id,
    is_delivered: c.is_delivered,
    started_at: new Date(c.started_at),
    delivery_completed_at: c.delivery_completed_at ? new Date(c.delivery_completed_at) : undefined,
  }));

  await db.poju_cycles.bulkPut(rows);

  await db.poju_tool_suggestions.where("session_id").equals(sessionId).delete();

  const suggestionRows = cycles.flatMap((c) =>
    c.tool_suggestions.map((s, idx) => ({
      suggestion_id: \`\${c.cycle_id}__\${s.tool}__\${idx}__\${s.suggested_at}\`,
      session_id: sessionId,
      cycle_id: c.cycle_id,
      owner_key: ownerKey,
      tool: s.tool,
      user_action: s.user_action,
      suggested_at: new Date(s.suggested_at),
      tool_completed_at: s.tool_completed_at ? new Date(s.tool_completed_at) : undefined,
    })),
  );

  if (suggestionRows.length > 0) {
    await db.poju_tool_suggestions.bulkPut(suggestionRows);
  }
}`,
  `async function writeCycleIndexRows(
  db: PojuDb,
  state: POJUSessionState,
  ownerKey: string,
): Promise<void> {
  const cycles = state.cycles ?? [];
  const sessionId = state.session_id;
  const deviceId = state.device_id;

  // Always clear prior index rows in the same transaction — including when
  // cycles were emptied — so stale cycle/suggestion indexes cannot survive.
  await db.poju_cycles.where("session_id").equals(sessionId).delete();
  await db.poju_tool_suggestions.where("session_id").equals(sessionId).delete();

  if (!cycles.length) return;

  const rows = cycles.map((c) => ({
    cycle_id: c.cycle_id,
    session_id: sessionId,
    device_id: deviceId,
    owner_key: ownerKey,
    cycle_index: c.cycle_index,
    is_active: c.cycle_id === state.active_cycle_id,
    is_delivered: c.is_delivered,
    started_at: new Date(c.started_at),
    delivery_completed_at: c.delivery_completed_at ? new Date(c.delivery_completed_at) : undefined,
  }));

  await db.poju_cycles.bulkPut(rows);

  const suggestionRows = cycles.flatMap((c) =>
    c.tool_suggestions.map((s, idx) => ({
      suggestion_id: \`\${c.cycle_id}__\${s.tool}__\${idx}__\${s.suggested_at}\`,
      session_id: sessionId,
      cycle_id: c.cycle_id,
      owner_key: ownerKey,
      tool: s.tool,
      user_action: s.user_action,
      suggested_at: new Date(s.suggested_at),
      tool_completed_at: s.tool_completed_at ? new Date(s.tool_completed_at) : undefined,
    })),
  );

  if (suggestionRows.length > 0) {
    await db.poju_tool_suggestions.bulkPut(suggestionRows);
  }
}`,
  "writeCycleIndexRows empty cleanup",
);

mustReplace(
  "lib/poju/cycle-db-sync.ts",
  `export async function syncSessionCyclesToDb(state: POJUSessionState): Promise<void> {
  if (typeof window === "undefined") return;
  const cycles = state.cycles;
  if (!cycles?.length) return;

  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  await writeCycleIndexRows(db, state, ownerKey);
}`,
  `export async function syncSessionCyclesToDb(state: POJUSessionState): Promise<void> {
  if (typeof window === "undefined") return;

  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  // writeCycleIndexRows deletes old rows even when cycles is empty.
  await writeCycleIndexRows(db, state, ownerKey);
}`,
  "syncSessionCyclesToDb allow empty cleanup",
);

// Fix 4 support: test reset hook for PojuDb singleton
mustReplace(
  "lib/db/poju-db.ts",
  `let singleton: PojuDb | null = null;

export function getPojuDb(): PojuDb {
  if (!singleton) singleton = new PojuDb();
  return singleton;
}

/** Wait for Dexie open — avoids empty archive list on first PWA paint / locale remount. */
export async function ensurePojuDbReady(): Promise<PojuDb> {
  const db = getPojuDb();
  if (!db.isOpen()) {
    await db.open();
  }
  return db;
}`,
  `let singleton: PojuDb | null = null;

export function getPojuDb(): PojuDb {
  if (!singleton) singleton = new PojuDb();
  return singleton;
}

/** Wait for Dexie open — avoids empty archive list on first PWA paint / locale remount. */
export async function ensurePojuDbReady(): Promise<PojuDb> {
  const db = getPojuDb();
  if (!db.isOpen()) {
    await db.open();
  }
  return db;
}

/** Test-only: close + drop the Dexie singleton so IDB suites start clean. */
export async function __resetPojuDbForTests(): Promise<void> {
  if (singleton) {
    try {
      singleton.close();
    } catch {
      /* ignore */
    }
    singleton = null;
  }
  await Dexie.delete("pojulife_v4");
}`,
  "poju-db test reset hook",
);

console.log("all production patches applied");
