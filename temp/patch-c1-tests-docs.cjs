const fs = require("fs");

function mustReplaceOnce(src, from, to, label) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error(`PATCH FAIL (${label}): anchor not found:\n${from.slice(0, 220)}`);
  const j = src.indexOf(from, i + 1);
  if (j >= 0) throw new Error(`PATCH FAIL (${label}): anchor not unique`);
  return src.slice(0, i) + to + src.slice(i + from.length);
}

{
  const p = "scripts/test-decision-context-phase3-idb.ts";
  let s = fs.readFileSync(p, "utf8");

  s = mustReplaceOnce(
    s,
    `  const {
    createPOJUSession,
    loadPOJUSession,
    savePOJUSessionCore,
  } = await import("../lib/poju/session-manager");`,
    `  const {
    createPOJUSession,
    loadPOJUSession,
    savePOJUSessionCore,
    extendPOJUV4Session,
  } = await import("../lib/poju/session-manager");`,
    "import extendPOJUV4Session",
  );

  const tests = `
  // ---------- Phase 3 rem C1 — metadata vs blob unified CAS ----------
  await p3("P3-136", "C1 extend: blob/encrypt fail → renewals unchanged (no metadata-only advance)", async () => {
    await resetDb();
    const sid = await createPOJUSession({ payment_id: "pay_s5_136", original_question: "136" });
    const db = getPojuDb();
    const rowBefore = await db.pojuSessionRecords.get(sid);
    const before = await loadPOJUSession(sid);
    assert.ok(rowBefore && before);
    const renewalsBefore = JSON.stringify(rowBefore!.renewals ?? []);
    const expBefore = rowBefore!.expires_at.getTime();
    const blobExpBefore = before!.expires_at;
    const cipherBefore = rowBefore!.encrypted_data;
    const sRevBefore = before!.session_revision;
    const renewalsLenBefore = (rowBefore!.renewals ?? []).length;

    let encryptCalls = 0;
    const failingEncrypt: typeof encryptJson = async (_secret, payload) => {
      encryptCalls += 1;
      assert.equal((payload as any).session_id, sid);
      throw new Error("simulated-c1-encrypt-failure");
    };

    let threw = false;
    let thrownMsg = "";
    try {
      await extendPOJUV4Session(sid, "pay_extend_136", { encrypt: failingEncrypt });
    } catch (err) {
      threw = true;
      thrownMsg = err instanceof Error ? err.message : String(err);
    }
    assert.equal(threw, true, "encrypt failure must throw");
    assert.match(thrownMsg, /simulated-c1-encrypt-failure/);
    assert.ok(encryptCalls >= 1);

    const rowAfter = await db.pojuSessionRecords.get(sid);
    const after = await loadPOJUSession(sid);
    assert.equal(JSON.stringify(rowAfter!.renewals ?? []), renewalsBefore, "renewals must not advance without blob");
    assert.equal((rowAfter!.renewals ?? []).length, renewalsLenBefore);
    assert.equal(rowAfter!.expires_at.getTime(), expBefore);
    assert.equal(after!.expires_at, blobExpBefore);
    assert.equal(rowAfter!.encrypted_data, cipherBefore);
    assert.equal(after!.session_revision, sRevBefore);

    // Retry without inject — unified write commits renewals + blob together.
    const ok = await extendPOJUV4Session(sid, "pay_extend_136");
    assert.ok(ok);
    const rowOk = await db.pojuSessionRecords.get(sid);
    const afterOk = await loadPOJUSession(sid);
    assert.ok((rowOk!.renewals ?? []).some((r) => r.payment_id === "pay_extend_136"));
    assert.ok(rowOk!.expires_at.getTime() > expBefore);
    assert.notEqual(afterOk!.expires_at, blobExpBefore);
    assert.equal(afterOk!.expires_at, rowOk!.expires_at.toISOString());
    assert.ok((afterOk!.session_revision ?? 0) > (sRevBefore ?? 0));

    // Idempotent same payment_id — no duplicate renewal.
    const again = await extendPOJUV4Session(sid, "pay_extend_136");
    assert.ok(again);
    const rowAgain = await db.pojuSessionRecords.get(sid);
    const pays = (rowAgain!.renewals ?? []).filter((r) => r.payment_id === "pay_extend_136");
    assert.equal(pays.length, 1, "same payment_id must not duplicate renewals");
  });

  await p3("P3-137", "C1 extend: mid-txn fail → renewals+blob both rolled back (reverse of metadata-only)", async () => {
    await resetDb();
    const sid = await createPOJUSession({ payment_id: "pay_s5_137", original_question: "137" });
    const db = getPojuDb();
    const rowBefore = await db.pojuSessionRecords.get(sid);
    const before = await loadPOJUSession(sid);
    const renewalsBefore = JSON.stringify(rowBefore!.renewals ?? []);
    const expBefore = rowBefore!.expires_at.getTime();
    const cipherBefore = rowBefore!.encrypted_data;
    const sRevBefore = before!.session_revision;
    const rowSBefore = rowBefore!.session_revision;

    let syncCalls = 0;
    const failingSync: typeof syncSessionCyclesToDbWithDb = async () => {
      syncCalls += 1;
      throw new Error("simulated-c1-cyclesync-failure");
    };

    let threw = false;
    let thrownMsg = "";
    try {
      await extendPOJUV4Session(sid, "pay_extend_137", { cycleSync: failingSync });
    } catch (err) {
      threw = true;
      thrownMsg = err instanceof Error ? err.message : String(err);
    }
    assert.equal(threw, true);
    assert.match(thrownMsg, /simulated-c1-cyclesync-failure/);
    assert.ok(syncCalls >= 1, "cycleSync must run inside the CAS txn");

    const rowAfter = await db.pojuSessionRecords.get(sid);
    const after = await loadPOJUSession(sid);
    assert.equal(JSON.stringify(rowAfter!.renewals ?? []), renewalsBefore, "renewals rolled back with blob");
    assert.equal(rowAfter!.expires_at.getTime(), expBefore);
    assert.equal(rowAfter!.encrypted_data, cipherBefore);
    assert.equal(rowAfter!.session_revision, rowSBefore);
    assert.equal(after!.session_revision, sRevBefore);
    assert.equal(after!.expires_at, before!.expires_at);

    const ok = await extendPOJUV4Session(sid, "pay_extend_137");
    assert.ok(ok);
    const rowOk = await db.pojuSessionRecords.get(sid);
    assert.ok((rowOk!.renewals ?? []).some((r) => r.payment_id === "pay_extend_137"));
    assert.ok(rowOk!.expires_at.getTime() > expBefore);
    assert.notEqual(rowOk!.encrypted_data, cipherBefore);
  });

  await p3("P3-138", "C1 recovery: blob already extended, renewals missing → append without clobber", async () => {
    await resetDb();
    const sid = await createPOJUSession({ payment_id: "pay_s5_138", original_question: "138" });
    const db = getPojuDb();
    const payId = "pay_extend_138_recover";

    // First successful unified extend.
    const first = await extendPOJUV4Session(sid, payId);
    assert.ok(first);
    const rowAfterFirst = await db.pojuSessionRecords.get(sid);
    assert.ok((rowAfterFirst!.renewals ?? []).some((r) => r.payment_id === payId));
    const expIso = first!.expires_at;
    const renewalsLen = (rowAfterFirst!.renewals ?? []).length;

    // Simulate legacy residue: strip renewals entry but keep blob/row expires (metadata missing).
    const stripped = (rowAfterFirst!.renewals ?? []).filter((r) => r.payment_id !== payId);
    await db.pojuSessionRecords.update(sid, { renewals: stripped });
    const rowStripped = await db.pojuSessionRecords.get(sid);
    assert.equal((rowStripped!.renewals ?? []).some((r) => r.payment_id === payId), false);
    assert.equal(rowStripped!.expires_at.toISOString(), expIso);

    // Re-run same payment_id — mutate no-op gate must still append renewals.
    const recovered = await extendPOJUV4Session(sid, payId);
    assert.ok(recovered);
    const rowRec = await db.pojuSessionRecords.get(sid);
    assert.ok((rowRec!.renewals ?? []).some((r) => r.payment_id === payId));
    assert.equal((rowRec!.renewals ?? []).filter((r) => r.payment_id === payId).length, 1);
    assert.equal(rowRec!.expires_at.toISOString(), expIso);
    // Content-identical blob may still bump session_revision on the recovery write.
    assert.ok((rowRec!.renewals ?? []).length >= renewalsLen);
  });

`;

  s = mustReplaceOnce(
    s,
    `\n  summarize("phase3-s5-idb");\n}`,
    tests + `\n  summarize("phase3-s5-idb");\n}`,
    "insert C1 tests before summarize",
  );

  fs.writeFileSync(p, s);
  console.log("patched idb tests");
}

// docs
{
  const p = "docs/phase3/PHASE3-S1-WRITE-PATH-AUDIT.md";
  let s = fs.readFileSync(p, "utf8");
  s = mustReplaceOnce(
    s,
    `| **W3** | \`extendPOJUV4Session\` | **Open C1 documented** | Metadata \`update\` (renewals/expires/last_interaction) stays **non-blob**; blob via \`savePOJUSession\` → CAS. Chose S0 C1 option (a): keep separate atomicity boundaries; did **not** invent fold-into-single-CAS policy. |`,
    `| **W3** | \`extendPOJUV4Session\` | **Closed C1 (rem)** | Renewals folded into the **same Dexie CAS update** as \`encrypted_data\` / expires mirrors via \`mutatePOJUSession.append_renewal\` → \`casWritePOJUSession\`. No second Session write authority. Honest claim: **row-atomic** (one \`update()\`), not a cross-store distributed txn. |`,
    "S1 W3 closed",
  );
  s = mustReplaceOnce(
    s,
    `1. **C1** extend two-phase vs single CAS — documented option (a); no policy invention.`,
    `1. **C1** extend metadata vs blob — **closed (rem)**: unified CAS \`append_renewal\` (same Dexie update). Tests P3-136/137/138.`,
    "S1 ambiguity C1 closed",
  );
  fs.writeFileSync(p, s);
  console.log("patched", p);
}

{
  const p = "docs/phase3/PHASE3-S0-SESSION-WRITE-INVENTORY.md";
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("| C1 | W3 `extendPOJUV4Session` |")) {
    s = mustReplaceOnce(
      s,
      `| C1 | W3 \`extendPOJUV4Session\` | Metadata \`update\` then separate \`savePOJUSession\` — not one atomic CAS today | (a) document two-phase with failure handling; (b) fold expiry into single CAS mutate; Mapping says keep correct boundaries — S1 must pick without inventing Contract text |`,
      `| C1 | W3 \`extendPOJUV4Session\` | **CLOSED (rem)**: renewals + blob expires share one Dexie CAS \`update\` via \`append_renewal\` (not a second write authority). Pre-rem: metadata then separate save. | Rem chose fold into existing CAS write (same row). Tests P3-136 (encrypt fail → no renewals advance), P3-137 (mid-txn fail → both roll back), P3-138 (legacy renewals-missing recovery). |`,
      "S0 C1 closed",
    );
    fs.writeFileSync(p, s);
    console.log("patched", p);
  } else {
    console.log("S0 C1 row shape differs — skip auto patch");
  }
}

{
  const p = "docs/phase3/PHASE3-S5-P3-TEST-INDEX.md";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("P3-136")) {
    // append after P3-135 row
    const anchor = `| P3-135 |`;
    const i = s.indexOf(anchor);
    if (i < 0) throw new Error("P3-135 row missing");
    const lineEnd = s.indexOf("\n", i);
    const insert = `
| P3-136 | C1 extend encrypt/blob fail → renewals unchanged | C1 rem / §7 | test-decision-context-phase3-idb.ts | metadata must not advance alone |
| P3-137 | C1 extend mid-txn fail → renewals+blob rollback | C1 rem / §7 | test-decision-context-phase3-idb.ts | reverse of metadata-only commit |
| P3-138 | C1 recovery blob OK renewals missing → append | C1 rem / §7 | test-decision-context-phase3-idb.ts | legacy split residue recoverable |`;
    s = s.slice(0, lineEnd) + insert + s.slice(lineEnd);
    fs.writeFileSync(p, s);
    console.log("patched S5 index");
  }
}

console.log("docs+tests done");
