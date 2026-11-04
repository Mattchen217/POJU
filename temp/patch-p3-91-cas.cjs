const fs = require("fs");

// --- patch session-mutation.ts for staged pre-binding write ---
{
  const p = "lib/poju/session-mutation.ts";
  let s = fs.readFileSync(p, "utf8");

  if (!s.includes("testStagedPreBinding?")) {
    const marker = `  /**
   * Test-only cycle-index sync override. Production omits this so the real
   * syncSessionCyclesToDbWithDb runs inside the C1 Dexie transaction (P3-71).
   */
  cycleSync?: typeof syncSessionCyclesToDbWithDb;
}`;
    const neu = `  /**
   * Test-only cycle-index sync override. Production omits this so the real
   * syncSessionCyclesToDbWithDb runs inside the C1 Dexie transaction (P3-71).
   */
  cycleSync?: typeof syncSessionCyclesToDbWithDb;
  /**
   * Test-only (P3-91): inside the Dexie txn, write this candidate first
   * (Registry/DC present, Binding not yet), run afterWrite (may throw), then
   * write the final candidate. Production omits — single final write only.
   */
  testStagedPreBinding?: {
    candidate: POJUSessionState;
    afterWrite?: () => void | Promise<void>;
  };
}`;
    if (!s.includes(marker)) {
      console.error("cycleSync field block not found");
      process.exit(1);
    }
    s = s.replace(marker, neu);
  }

  // After computing payload for final, also encrypt staged candidate outside txn
  if (!s.includes("stagedPayload")) {
    const encBlock = `  // §7.5 step 6 — encrypt OUTSIDE the Dexie transaction
  const encrypt = input.encrypt ?? encryptJson;
  const payload = await encrypt(SESSION_SECRET, committedState);`;
    const encBlockNew = `  // §7.5 step 6 — encrypt OUTSIDE the Dexie transaction
  const encrypt = input.encrypt ?? encryptJson;
  const payload = await encrypt(SESSION_SECRET, committedState);

  // P3-91 test-only staged encrypt (also outside txn)
  let stagedPayload: { cipher: string; iv: string } | null = null;
  let stagedCommitted: POJUSessionState | null = null;
  if (input.testStagedPreBinding) {
    stagedCommitted = {
      ...input.testStagedPreBinding.candidate,
      session_revision: nextSessionRevision,
      dc_write_revision: nextDcWriteRevision,
    };
    stagedPayload = await encrypt(SESSION_SECRET, stagedCommitted);
  }`;
    if (!s.includes(encBlock)) {
      console.error("encrypt block not found");
      process.exit(1);
    }
    s = s.replace(encBlock, encBlockNew);
  }

  // Inside run(), before final update, do staged write
  if (!s.includes("testStagedPreBinding stage1")) {
    const step12 = `    // §7.5 step 12 — atomic blob + mirrors + indexes
    const updated = await db.pojuSessionRecords.update(sessionId, {
      encrypted_data: payload.cipher,
      iv: payload.iv,
      session_revision: nextSessionRevision,
      dc_write_revision: nextDcWriteRevision,`;
    const step12New = `    // §7.5 step 12 — atomic blob + mirrors + indexes
    // P3-91 test-only: stage1 write (Registry/DC, no Binding) before final write.
    if (stagedPayload && stagedCommitted && input.testStagedPreBinding) {
      const stageUpdated = await db.pojuSessionRecords.update(sessionId, {
        encrypted_data: stagedPayload.cipher,
        iv: stagedPayload.iv,
        session_revision: nextSessionRevision,
        dc_write_revision: nextDcWriteRevision,
        original_question: stagedCommitted.original_question.trim(),
        last_interaction_at: new Date(stagedCommitted.last_interaction_at),
        expires_at: new Date(stagedCommitted.expires_at),
        tokens_used: stagedCommitted.tokens_used,
        turn_count: countUserTurns(stagedCommitted),
        current_state_hint: getCurrentStateHint(stagedCommitted),
        main_delivery_done: stagedCommitted.main_delivery_done,
        main_delivery_at: stagedCommitted.main_delivery_done ? new Date() : undefined,
        active_cycle_id: stagedCommitted.active_cycle_id,
      });
      if (stageUpdated !== 1) {
        throw new SessionCasError(
          SESSION_CAS_CONFLICT,
          \`pojuSessionRecords staged update expected 1 row, got \${stageUpdated}\`,
        );
      }
      // testStagedPreBinding stage1 complete — Binding not yet in blob
      if (input.testStagedPreBinding.afterWrite) {
        await input.testStagedPreBinding.afterWrite();
      }
    }

    const updated = await db.pojuSessionRecords.update(sessionId, {
      encrypted_data: payload.cipher,
      iv: payload.iv,
      session_revision: nextSessionRevision,
      dc_write_revision: nextDcWriteRevision,`;
    if (!s.includes(step12)) {
      console.error("step12 block not found");
      process.exit(1);
    }
    s = s.replace(step12, step12New);
  }

  fs.writeFileSync(p, s);
  console.log("session-mutation staged write OK");
}
