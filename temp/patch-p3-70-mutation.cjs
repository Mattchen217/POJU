const fs = require("fs");
const p = "lib/poju/session-mutation.ts";
let s = fs.readFileSync(p, "utf8");

const a = `  generation_base_revision?: number;\n  owner_key?: string;\n}`;
const b = `  generation_base_revision?: number;\n  owner_key?: string;\n  /**\n   * Test-only encrypt override. Production callers omit this so the real\n   * encryptJson path runs. Used to inject encrypt failures before the Dexie\n   * write transaction (Contract §15.3 / P3-70).\n   */\n  encrypt?: typeof encryptJson;\n}`;
if (!s.includes(a)) {
  console.error("CasWrite input block not found");
  process.exit(1);
}
if (s.includes("encrypt?: typeof encryptJson")) {
  console.log("encrypt already present on CasWrite input (skip interface)");
} else {
  s = s.replace(a, b);
}

const oldEnc =
  "  // §7.5 step 6 — encrypt OUTSIDE the Dexie transaction\n  const payload = await encryptJson(SESSION_SECRET, committedState);";
const newEnc =
  "  // §7.5 step 6 — encrypt OUTSIDE the Dexie transaction\n  const encrypt = input.encrypt ?? encryptJson;\n  const payload = await encrypt(SESSION_SECRET, committedState);";
if (!s.includes(oldEnc)) {
  // try ASCII hyphen variants / emdash
  const alt = s.match(/  \/\/ §7\.5 step 6[^\n]*\n  const payload = await encryptJson\(SESSION_SECRET, committedState\);/);
  if (!alt) {
    console.error("encrypt call not found");
    const idx = s.indexOf("encryptJson(SESSION_SECRET, committedState)");
    console.error("idx", idx, JSON.stringify(s.slice(Math.max(0, idx - 80), idx + 80)));
    process.exit(1);
  }
  s = s.replace(alt[0], newEnc);
} else {
  s = s.replace(oldEnc, newEnc);
}

const oldOpts = `export interface MutatePOJUSessionOptions {
  max_retries?: number;
  /** Injected for tests. */
  load?: (sessionId: string) => Promise<{
    row: POJUSessionRecord;
    state: POJUSessionState;
  } | null>;
  casWrite?: typeof casWritePOJUSession;
}`;
const newOpts = `export interface MutatePOJUSessionOptions {
  max_retries?: number;
  /** Injected for tests. */
  load?: (sessionId: string) => Promise<{
    row: POJUSessionRecord;
    state: POJUSessionState;
  } | null>;
  casWrite?: typeof casWritePOJUSession;
  /** Test-only: forwarded to casWritePOJUSession.encrypt (P3-70). */
  encrypt?: typeof encryptJson;
}`;
if (!s.includes(oldOpts)) {
  console.error("Mutate options not found");
  process.exit(1);
}
if (!s.includes("Test-only: forwarded to casWritePOJUSession.encrypt")) {
  s = s.replace(oldOpts, newOpts);
}

const oldWrite = `      return await write({
        candidate,
        expected_session_revision: mirror.session_revision,
        expected_dc_write_revision: mirror.dc_write_revision,
        bump_dc_write_revision: bumpDc,
        ...(mutation.generation_base_revision !== undefined
          ? { generation_base_revision: mutation.generation_base_revision }
          : {}),
      });`;
const newWrite = `      return await write({
        candidate,
        expected_session_revision: mirror.session_revision,
        expected_dc_write_revision: mirror.dc_write_revision,
        bump_dc_write_revision: bumpDc,
        ...(mutation.generation_base_revision !== undefined
          ? { generation_base_revision: mutation.generation_base_revision }
          : {}),
        ...(opts.encrypt ? { encrypt: opts.encrypt } : {}),
      });`;
if (!s.includes(oldWrite)) {
  console.error("write call not found");
  process.exit(1);
}
if (!s.includes("opts.encrypt ? { encrypt: opts.encrypt }")) {
  s = s.replace(oldWrite, newWrite);
}

fs.writeFileSync(p, s);
console.log("patched session-mutation.ts OK");
