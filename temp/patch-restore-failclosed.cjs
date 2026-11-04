const fs = require("fs");

function replaceOnce(src, from, to, label) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error("missing " + label + "\n" + from.slice(0, 200));
  if (src.indexOf(from, i + 1) >= 0) throw new Error("dup " + label);
  return src.slice(0, i) + to + src.slice(i + from.length);
}

{
  const p = "lib/poju/v4-lifecycle.ts";
  let s = fs.readFileSync(p, "utf8");
  s = replaceOnce(
    s,
    `import { loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";`,
    `import { loadPOJUSession, runPOJUSessionPostCommitSideEffects } from "@/lib/poju/session-manager";
import { mutatePOJUSession } from "@/lib/poju/session-mutation";`,
    "imports",
  );

  // Use regex for CRLF body
  const re =
    /export async function restorePOJUV4ArchivedSession\(\r?\n  sessionId: string,\r?\n  paymentId: string,\r?\n\): Promise<boolean> \{[\s\S]*?\n\}\r?\n\r?\nexport async function permanentlyDeletePOJUV4Session/;
  if (!re.test(s)) throw new Error("restore fn regex miss");

  const nl = s.includes("\r\n") ? "\r\n" : "\n";
  const body = [
    `export async function restorePOJUV4ArchivedSession(`,
    `  sessionId: string,`,
    `  paymentId: string,`,
    `): Promise<boolean> {`,
    `  const db = getPojuDb();`,
    `  const ownerKey = await resolveLocalOwnerKey();`,
    `  const arch = await db.pojuSessionArchive.get(sessionId);`,
    `  const row = await db.pojuSessionRecords.get(sessionId);`,
    `  if (!arch || !row || row.status !== "archived") return false;`,
    `  if (!isRowOwnedBy(row, ownerKey) || !isRowOwnedBy(arch, ownerKey)) return false;`,
    `  if (getPojuDeviceId() !== row.device_id) return false;`,
    `  if (!paymentId.trim()) return false;`,
    ``,
    `  const payId = paymentId.trim();`,
    ``,
    `  // Phase 3 rem (C5 leftover): fail closed — require decryptable blob BEFORE`,
    `  // status/expires/renewals mutation or archive delete. Wrong metadata must not`,
    `  // become authority over an unverifiable Session blob.`,
    `  let state;`,
    `  try {`,
    `    state = await loadPOJUSession(sessionId);`,
    `  } catch {`,
    `    return false;`,
    `  }`,
    `  if (!state) return false;`,
    ``,
    `  const now = new Date();`,
    `  const exp = new Date(now.getTime() + THIRTY_DAYS_MS);`,
    `  const nowIso = now.toISOString();`,
    `  const expIso = exp.toISOString();`,
    ``,
    `  try {`,
    `    const result = await mutatePOJUSession(sessionId, {`,
    `      operation_id: \`restore_paid_\${payId}\`,`,
    `      kind: "session_patch",`,
    `      bump_dc: false,`,
    `      append_renewal: {`,
    `        extended_at: now,`,
    `        reason: "paid_restore",`,
    `        payment_id: payId,`,
    `      },`,
    `      apply: (latest) => ({`,
    `        ...latest,`,
    `        expires_at: expIso,`,
    `        last_interaction_at: nowIso,`,
    `      }),`,
    `    });`,
    `    await runPOJUSessionPostCommitSideEffects(result.state);`,
    `  } catch {`,
    `    // CAS failed — leave status=archived and archive row intact for retry.`,
    `    return false;`,
    `  }`,
    ``,
    `  // After verifiable blob+renewals commit: activate + drop archive copy.`,
    `  await db.pojuSessionRecords.update(sessionId, { status: "active" });`,
    `  await db.pojuSessionArchive.delete(sessionId);`,
    `  return true;`,
    `}`,
    ``,
    `export async function permanentlyDeletePOJUV4Session`,
  ].join(nl);

  s = s.replace(re, body);
  fs.writeFileSync(p, s);
  console.log("patched restore");
}

// Add small idb test
{
  const p = "scripts/test-decision-context-phase3-idb.ts";
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("P3-148")) {
    console.log("P3-148 already present");
  } else {
    const nl = s.includes("\r\n") ? "\r\n" : "\n";
    const test = `
  await p3("P3-148", "restore fail-closed: decrypt fail → status stays archived; archive kept; renewals unchanged", async () => {
    await resetDb();
    const sid = await createPOJUSession({ payment_id: "pay_s5_148", original_question: "148" });
    const db = getPojuDb();
    const row = await db.pojuSessionRecords.get(sid);
    assert.ok(row);
    // Archive the session the same way maintenance/resolve does (copy cipher + mark archived).
    await db.pojuSessionArchive.put({
      session_id: row!.session_id,
      device_id: row!.device_id,
      owner_key: row!.owner_key,
      encrypted_data: row!.encrypted_data,
      iv: row!.iv,
      archived_at: new Date(),
      original_question: row!.original_question,
      user_marked_resolved: false,
    });
    await db.pojuSessionRecords.update(sid, { status: "archived" });

    // Corrupt live blob so restore cannot verify Session content.
    await db.pojuSessionRecords.update(sid, {
      encrypted_data: "corrupt-restore-148",
      iv: "corrupt-iv-148",
    });
    const renewalsBefore = JSON.stringify((await db.pojuSessionRecords.get(sid))!.renewals ?? []);
    const { restorePOJUV4ArchivedSession } = await import("../lib/poju/v4-lifecycle");
    const ok = await restorePOJUV4ArchivedSession(sid, "pay_restore_148");
    assert.equal(ok, false);

    const rowAfter = await db.pojuSessionRecords.get(sid);
    const archAfter = await db.pojuSessionArchive.get(sid);
    assert.equal(rowAfter!.status, "archived", "must not activate without verifiable blob");
    assert.ok(archAfter, "archive row must remain for retry");
    assert.equal(JSON.stringify(rowAfter!.renewals ?? []), renewalsBefore, "renewals must not advance");
    assert.equal(rowAfter!.encrypted_data, "corrupt-restore-148", "must not rewrite cipher on fail");
  });

`.replace(/\n/g, nl);

    const marker = `${nl}  summarize("phase3-s5-idb");${nl}}`;
    const i = s.lastIndexOf(marker);
    if (i < 0) throw new Error("summarize marker missing");
    // Keep main().catch after marker
    s = s.slice(0, i) + test + s.slice(i);
    fs.writeFileSync(p, s);
    console.log("added P3-148");
  }
}

{
  const p = "docs/phase3/PHASE3-S5-P3-TEST-INDEX.md";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("P3-148")) {
    const anchor = "| P3-143 |";
    const i = s.indexOf(anchor);
    const lineEnd = s.indexOf("\n", i);
    s =
      s.slice(0, lineEnd) +
      `\n| P3-148 | restore decrypt fail → stay archived | C5 leftover rem | test-decision-context-phase3-idb.ts | fail-closed; archive kept |` +
      s.slice(lineEnd);
    fs.writeFileSync(p, s);
    console.log("index P3-148");
  }
}

console.log("restore patch done");
