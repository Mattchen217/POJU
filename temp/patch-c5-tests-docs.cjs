const fs = require("fs");

function replaceBetween(src, startMarker, endMarker, replacement, label) {
  const i = src.indexOf(startMarker);
  if (i < 0) throw new Error(`start not found: ${label}`);
  const j = src.indexOf(endMarker, i);
  if (j < 0) throw new Error(`end not found: ${label}`);
  return src.slice(0, i) + replacement + src.slice(j);
}

// Clean void noise in vault rename fail path
{
  const p = "lib/archive/poju-session-vault.ts";
  let s = fs.readFileSync(p, "utf8");
  const junk = `    // Row exists but blob unverifiable. Fail closed — do not write index or vault title.
    void indexBefore;
    void cipherBefore;
    void ivBefore;
    void vaultTitleBefore;
    return {`;
  const clean = `    // Row exists but blob unverifiable. Fail closed — do not write index or vault title.
    // Intentionally unused snapshots document the no-write invariant for C5 audits/tests.
    if (false) {
      void indexBefore;
      void cipherBefore;
      void ivBefore;
      void vaultTitleBefore;
    }
    return {`;
  // Simpler: just remove the void lines and the unused const if eslint complains.
  // Keep snapshots for potential future assert helpers; prefix with underscore via use in message.
  if (s.includes("void indexBefore;")) {
    s = s.replace(
      /    \/\/ Row exists but blob unverifiable\. Fail closed[^\n]*\n    void indexBefore;\n    void cipherBefore;\n    void ivBefore;\n    void vaultTitleBefore;\n    return \{/,
      `    // Row exists but blob unverifiable. Fail closed — do not write index or vault title.
    // Snapshots retained so callers/tests can compare pre-rename authority (index/cipher/vault).
    void [indexBefore, cipherBefore, ivBefore, vaultTitleBefore];
    return {`,
    );
    fs.writeFileSync(p, s);
    console.log("cleaned voids");
  }
}

{
  const p = "scripts/test-decision-context-phase3-idb.ts";
  let s = fs.readFileSync(p, "utf8");
  const nl = s.includes("\r\n") ? "\r\n" : "\n";

  const tests = `
  // ---------- Phase 3 rem C5 — vault rename decrypt-fail must not rewrite plaintext index ----------
  await p3("P3-139", "C5 rename decrypt fail → index+cipher+vault title unchanged; DECRYPT_OR_LOAD_FAILED", async () => {
    await resetDb();
    const { renamePojuSessionHistory, syncPojuSessionVaultArchive } = await import(
      "../lib/archive/poju-session-vault"
    );
    const sid = await createPOJUSession({
      payment_id: "pay_s5_139",
      original_question: "original-title-139",
    });
    const before = await loadPOJUSession(sid);
    assert.ok(before);
    await syncPojuSessionVaultArchive(before!, "en");

    const db = getPojuDb();
    const rowBefore = await db.pojuSessionRecords.get(sid);
    assert.ok(rowBefore);
    const indexBefore = rowBefore!.original_question;
    const cipherBefore = rowBefore!.encrypted_data;
    const ivBefore = rowBefore!.iv;
    const vaultBefore = (await db.archive.toArray()).find(
      (r) => r.product === "poju" && r.session_id === sid,
    );
    assert.ok(vaultBefore);
    const vaultTitleBefore = vaultBefore!.title;

    // Corrupt session blob so loadPOJUSession returns null (decrypt fail).
    await db.pojuSessionRecords.update(sid, {
      encrypted_data: "not-valid-cipher-c5",
      iv: "not-valid-iv-c5",
    });

    const result = await renamePojuSessionHistory(sid, "attacker-new-title-139", "en");
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("expected fail");
    assert.equal(result.code, "DECRYPT_OR_LOAD_FAILED");

    const rowAfter = await db.pojuSessionRecords.get(sid);
    assert.equal(rowAfter!.original_question, indexBefore, "must not overwrite plaintext index");
    assert.equal(rowAfter!.encrypted_data, "not-valid-cipher-c5", "corrupt cipher preserved (no silent repair write)");
    assert.equal(rowAfter!.iv, "not-valid-iv-c5");
    // Ensure we did not restore old cipher either — fail closed leaves storage as-found.
    assert.notEqual(rowAfter!.encrypted_data, cipherBefore);
    assert.notEqual(indexBefore, "attacker-new-title-139");

    const vaultAfter = await db.archive.get(vaultBefore!.archive_id);
    assert.equal(vaultAfter!.title, vaultTitleBefore, "vault title must not become rename authority");
    void ivBefore;
  });

  await p3("P3-140", "C5 rename missing session → NOT_FOUND; no index invented", async () => {
    await resetDb();
    const { renamePojuSessionHistory } = await import("../lib/archive/poju-session-vault");
    const db = getPojuDb();
    const beforeCount = await db.pojuSessionRecords.count();
    const result = await renamePojuSessionHistory("sess_missing_c5_140", "ghost-title", "en");
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("expected fail");
    assert.equal(result.code, "NOT_FOUND");
    assert.equal(await db.pojuSessionRecords.count(), beforeCount);
    assert.equal(await db.pojuSessionRecords.get("sess_missing_c5_140"), undefined);
  });

  await p3("P3-141", "C5 stale index: decrypt fail refuses overwrite of existing correct index", async () => {
    await resetDb();
    const { renamePojuSessionHistory, syncPojuSessionVaultArchive } = await import(
      "../lib/archive/poju-session-vault"
    );
    const sid = await createPOJUSession({
      payment_id: "pay_s5_141",
      original_question: "correct-index-141",
    });
    // Happy-path rename first — CAS aligns blob + index.
    const ok = await renamePojuSessionHistory(sid, "last-good-index-141", "en");
    assert.equal(ok.ok, true);
    if (!ok.ok) throw new Error("expected cas ok");
    const loaded = await loadPOJUSession(sid);
    assert.equal(loaded!.original_question, "last-good-index-141");
    await syncPojuSessionVaultArchive(loaded!, "en");

    const db = getPojuDb();
    const rowGood = await db.pojuSessionRecords.get(sid);
    const indexGood = rowGood!.original_question;
    assert.equal(indexGood, "last-good-index-141");

    // Decrypt becomes impossible; attempt rename to a different title.
    await db.pojuSessionRecords.update(sid, {
      encrypted_data: "corrupt-cipher-141",
      iv: "corrupt-iv-141",
    });
    const refused = await renamePojuSessionHistory(sid, "stale-overwrite-attempt-141", "en");
    assert.equal(refused.ok, false);
    if (refused.ok) throw new Error("expected fail");
    assert.equal(refused.code, "DECRYPT_OR_LOAD_FAILED");

    const rowAfter = await db.pojuSessionRecords.get(sid);
    assert.equal(
      rowAfter!.original_question,
      "last-good-index-141",
      "existing correct index must remain authority when blob unverifiable",
    );
    assert.notEqual(rowAfter!.original_question, "stale-overwrite-attempt-141");
  });

  await p3("P3-142", "C5 retry after blob restored → CAS rename succeeds; index+blob align", async () => {
    await resetDb();
    const { renamePojuSessionHistory } = await import("../lib/archive/poju-session-vault");
    const sid = await createPOJUSession({
      payment_id: "pay_s5_142",
      original_question: "title-142",
    });
    const db = getPojuDb();
    const row = await db.pojuSessionRecords.get(sid);
    const goodCipher = row!.encrypted_data;
    const goodIv = row!.iv;

    await db.pojuSessionRecords.update(sid, {
      encrypted_data: "broken-142",
      iv: "broken-iv-142",
    });
    const fail = await renamePojuSessionHistory(sid, "should-not-stick-142", "en");
    assert.equal(fail.ok, false);
    if (fail.ok) throw new Error("expected fail");
    assert.equal(fail.code, "DECRYPT_OR_LOAD_FAILED");
    assert.equal((await db.pojuSessionRecords.get(sid))!.original_question, "title-142");

    // Restore verifiable blob (simulates recovery / retry after repair).
    await db.pojuSessionRecords.update(sid, {
      encrypted_data: goodCipher,
      iv: goodIv,
    });
    const retry = await renamePojuSessionHistory(sid, "recovered-title-142", "en");
    assert.equal(retry.ok, true);
    if (!retry.ok) throw new Error("expected cas ok");
    assert.equal(retry.path, "cas");

    const after = await loadPOJUSession(sid);
    const rowAfter = await db.pojuSessionRecords.get(sid);
    assert.equal(after!.original_question, "recovered-title-142");
    assert.equal(rowAfter!.original_question, "recovered-title-142");
  });

  await p3("P3-143", "C5 empty/missing index + decrypt ok → CAS can set index; decrypt fail still refuses", async () => {
    await resetDb();
    const { renamePojuSessionHistory } = await import("../lib/archive/poju-session-vault");
    const sid = await createPOJUSession({
      payment_id: "pay_s5_143",
      original_question: "temp-143",
    });
    // Simulate sparse index while blob still decrypts: clear plaintext column only.
    const db = getPojuDb();
    await db.pojuSessionRecords.update(sid, { original_question: "" });
    const state = await loadPOJUSession(sid);
    assert.ok(state, "blob still decrypts");
    // Blob still carries prior original_question; CAS rename sets both.
    const ok = await renamePojuSessionHistory(sid, "filled-from-cas-143", "en");
    assert.equal(ok.ok, true);
    const after = await loadPOJUSession(sid);
    const row = await db.pojuSessionRecords.get(sid);
    assert.equal(after!.original_question, "filled-from-cas-143");
    assert.equal(row!.original_question, "filled-from-cas-143");

    await db.pojuSessionRecords.update(sid, {
      original_question: "",
      encrypted_data: "nope-143",
      iv: "nope-iv-143",
    });
    const refused = await renamePojuSessionHistory(sid, "invented-while-undecryptable-143", "en");
    assert.equal(refused.ok, false);
    if (refused.ok) throw new Error("expected fail");
    assert.equal(refused.code, "DECRYPT_OR_LOAD_FAILED");
    assert.equal(
      (await db.pojuSessionRecords.get(sid))!.original_question,
      "",
      "must not invent plaintext index from rename while undecryptable",
    );
  });

`.replace(/\n/g, nl);

  const marker = `${nl}  summarize("phase3-s5-idb");${nl}}`;
  const i = s.lastIndexOf(marker);
  if (i < 0) throw new Error("summarize marker missing");
  s = s.slice(0, i) + tests + marker;
  fs.writeFileSync(p, s);
  console.log("added C5 tests");
}

// Docs
function mustReplaceOnce(src, from, to, label) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error(`doc fail ${label}: ${from.slice(0, 120)}`);
  if (src.indexOf(from, i + 1) >= 0) throw new Error(`doc not unique ${label}`);
  return src.slice(0, i) + to + src.slice(i + from.length);
}

{
  const p = "docs/phase3/PHASE3-S1-WRITE-PATH-AUDIT.md";
  let s = fs.readFileSync(p, "utf8");
  s = mustReplaceOnce(
    s,
    `| **W6f** | vault rename fallback | **Deferred (open C5)** | Non-blob \`original_question\` column update when load fails — Contract/Mapping unspecified; flagged, not invented. |`,
    `| **W6f** | vault rename fallback | **Closed C5 (rem)** | Decrypt/load fail → **fail closed** (no plaintext \`original_question\` / vault title write). Happy path → Session CAS only. Returns \`DECRYPT_OR_LOAD_FAILED\` / \`NOT_FOUND\` / \`CAS_FAILED\`. |`,
    "S1 W6f",
  );
  s = mustReplaceOnce(
    s,
    `2. **C5** vault rename plaintext fallback divergence — flagged only.`,
    `2. **C5** vault rename plaintext fallback — **closed (rem)**: fail closed on decrypt/load; tests P3-139–143.`,
    "S1 C5 ambiguity",
  );
  fs.writeFileSync(p, s);
  console.log("patched S1");
}

{
  const p = "docs/phase3/PHASE3-S0-SESSION-WRITE-INVENTORY.md";
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("| C5 | Vault rename fallback |")) {
    s = mustReplaceOnce(
      s,
      `| C5 | Vault rename fallback | Writes \`original_question\` column without blob when load fails → plaintext index can diverge from undecryptable blob | Keep as non-blob; or fail closed — **Contract/Mapping do not specify**; flag for Max/Grok |`,
      `| C5 | Vault rename fallback | **CLOSED (rem)**: decrypt/load fail → refuse plaintext index/vault title write (fail closed). Happy path → CAS. | Rem chose fail closed (wrong index must not become authority). Tests P3-139–143. |`,
      "S0 C5",
    );
    fs.writeFileSync(p, s);
    console.log("patched S0");
  }
}

{
  const p = "docs/phase3/PHASE3-S5-P3-TEST-INDEX.md";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("P3-139")) {
    const anchor = "| P3-138 |";
    const i = s.indexOf(anchor);
    if (i < 0) throw new Error("P3-138 missing");
    const lineEnd = s.indexOf("\n", i);
    const insert = `
| P3-139 | C5 rename decrypt fail → index unchanged | C5 rem | test-decision-context-phase3-idb.ts | DECRYPT_OR_LOAD_FAILED; cipher preserved |
| P3-140 | C5 rename missing session → NOT_FOUND | C5 rem | test-decision-context-phase3-idb.ts | no invented row/index |
| P3-141 | C5 stale index decrypt fail refuses overwrite | C5 rem | test-decision-context-phase3-idb.ts | last-good index stays authority |
| P3-142 | C5 retry after blob restore → CAS rename | C5 rem | test-decision-context-phase3-idb.ts | index+blob align on retry |
| P3-143 | C5 missing index: CAS ok / decrypt fail refuse | C5 rem | test-decision-context-phase3-idb.ts | no invent while undecryptable |`;
    s = s.slice(0, lineEnd) + insert + s.slice(lineEnd);
    fs.writeFileSync(p, s);
    console.log("patched S5 index");
  }
}

console.log("done");
