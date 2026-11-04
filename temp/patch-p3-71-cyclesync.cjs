const fs = require("fs");
const p = "lib/poju/session-mutation.ts";
let s = fs.readFileSync(p, "utf8");

if (!s.includes("cycleSync?: typeof syncSessionCyclesToDbWithDb")) {
  const a = `  /**\n   * Test-only encrypt override. Production callers omit this so the real\n   * encryptJson path runs. Used to inject encrypt failures before the Dexie\n   * write transaction (Contract §15.3 / P3-70).\n   */\n  encrypt?: typeof encryptJson;\n}`;
  const b = `  /**\n   * Test-only encrypt override. Production callers omit this so the real\n   * encryptJson path runs. Used to inject encrypt failures before the Dexie\n   * write transaction (Contract §15.3 / P3-70).\n   */\n  encrypt?: typeof encryptJson;\n  /**\n   * Test-only cycle-index sync override. Production omits this so the real\n   * syncSessionCyclesToDbWithDb runs inside the C1 Dexie transaction (P3-71).\n   */\n  cycleSync?: typeof syncSessionCyclesToDbWithDb;\n}`;
  if (!s.includes(a)) {
    console.error("encrypt field block not found");
    process.exit(1);
  }
  s = s.replace(a, b);
}

if (!s.includes("const syncCycles = input.cycleSync")) {
  const oldCall = "    await syncSessionCyclesToDbWithDb(db, committedState, ownerKey);";
  const newCall =
    "    const syncCycles = input.cycleSync ?? syncSessionCyclesToDbWithDb;\n    await syncCycles(db, committedState, ownerKey);";
  if (!s.includes(oldCall)) {
    console.error("sync call not found");
    process.exit(1);
  }
  s = s.replace(oldCall, newCall);
}

if (!s.includes("cycleSync?: typeof syncSessionCyclesToDbWithDb;") || !s.includes("Test-only: forwarded to casWritePOJUSession.encrypt")) {
  // add to Mutate options if missing
}
if (!s.includes("/** Test-only: forwarded to casWritePOJUSession.cycleSync (P3-71). */")) {
  const oldOpts = `  /** Test-only: forwarded to casWritePOJUSession.encrypt (P3-70). */
  encrypt?: typeof encryptJson;
}`;
  const newOpts = `  /** Test-only: forwarded to casWritePOJUSession.encrypt (P3-70). */
  encrypt?: typeof encryptJson;
  /** Test-only: forwarded to casWritePOJUSession.cycleSync (P3-71). */
  cycleSync?: typeof syncSessionCyclesToDbWithDb;
}`;
  if (!s.includes(oldOpts)) {
    console.error("mutate encrypt opt not found");
    process.exit(1);
  }
  s = s.replace(oldOpts, newOpts);
}

if (!s.includes("opts.cycleSync ? { cycleSync: opts.cycleSync }")) {
  const oldFwd = "        ...(opts.encrypt ? { encrypt: opts.encrypt } : {}),";
  const newFwd =
    "        ...(opts.encrypt ? { encrypt: opts.encrypt } : {}),\n        ...(opts.cycleSync ? { cycleSync: opts.cycleSync } : {}),";
  if (!s.includes(oldFwd)) {
    console.error("encrypt forward not found");
    process.exit(1);
  }
  s = s.replace(oldFwd, newFwd);
}

fs.writeFileSync(p, s);
console.log("session-mutation cycleSync inject OK");
