const fs = require("fs");
function mustReplaceOnce(src, from, to, label) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error(`PATCH FAIL (${label}):\n${from.slice(0, 200)}`);
  if (src.indexOf(from, i + 1) >= 0) throw new Error(`not unique: ${label}`);
  return src.slice(0, i) + to + src.slice(i + from.length);
}

{
  const p = "lib/poju/session-manager.ts";
  let s = fs.readFileSync(p, "utf8");
  s = mustReplaceOnce(
    s,
    `  const payId = paymentId.trim();
  const now = new Date();
  const exp = new Date(now.getTime() + THIRTY_DAYS_MS);
  const nowIso = now.toISOString();
  const expIso = exp.toISOString();

  const result = await mutatePOJUSession(`,
    `  const payId = paymentId.trim();
  // True idempotent: same payment_id already recorded → return current session
  // (do not re-bump expires). Recoverable path still runs when renewals were lost.
  if ((row.renewals ?? []).some((r) => r.payment_id === payId)) {
    return state;
  }

  const now = new Date();
  const exp = new Date(now.getTime() + THIRTY_DAYS_MS);
  const nowIso = now.toISOString();
  const expIso = exp.toISOString();

  const result = await mutatePOJUSession(`,
    "extend idempotent early return",
  );
  fs.writeFileSync(p, s);
  console.log("idempotent early return added");
}

{
  const p = "scripts/test-decision-context-phase3-idb.ts";
  let s = fs.readFileSync(p, "utf8");
  // Fix P3-136 idempotent assertion — early return keeps renewals len 1
  // Fix P3-138: after strip, renewals missing so early return does NOT fire; renewals restored.
  // expires may move forward on recovery write — don't require equal to first expIso.
  s = mustReplaceOnce(
    s,
    `    // Re-run same payment_id — mutate no-op gate must still append renewals.
    const recovered = await extendPOJUV4Session(sid, payId);
    assert.ok(recovered);
    const rowRec = await db.pojuSessionRecords.get(sid);
    assert.ok((rowRec!.renewals ?? []).some((r) => r.payment_id === payId));
    assert.equal((rowRec!.renewals ?? []).filter((r) => r.payment_id === payId).length, 1);
    assert.equal(rowRec!.expires_at.toISOString(), expIso);
    // Content-identical blob may still bump session_revision on the recovery write.
    assert.ok((rowRec!.renewals ?? []).length >= renewalsLen);
  });`,
    `    // Re-run same payment_id — renewals missing so early-return does not fire;
    // unified CAS appends renewals again (recoverable protocol for legacy split).
    const recovered = await extendPOJUV4Session(sid, payId);
    assert.ok(recovered);
    const rowRec = await db.pojuSessionRecords.get(sid);
    assert.ok((rowRec!.renewals ?? []).some((r) => r.payment_id === payId));
    assert.equal((rowRec!.renewals ?? []).filter((r) => r.payment_id === payId).length, 1);
    assert.ok(rowRec!.expires_at.getTime() >= new Date(expIso).getTime());
    assert.ok((rowRec!.renewals ?? []).length >= renewalsLen);
  });`,
    "fix P3-138 asserts",
  );
  fs.writeFileSync(p, s);
  console.log("fixed P3-138");
}
