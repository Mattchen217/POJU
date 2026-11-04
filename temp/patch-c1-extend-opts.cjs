const fs = require("fs");

function mustReplaceOnce(src, from, to, label) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error(`PATCH FAIL (${label}): anchor not found:\n${from.slice(0, 220)}`);
  const j = src.indexOf(from, i + 1);
  if (j >= 0) throw new Error(`PATCH FAIL (${label}): anchor not unique`);
  return src.slice(0, i) + to + src.slice(i + from.length);
}

{
  const p = "lib/poju/session-manager.ts";
  let s = fs.readFileSync(p, "utf8");

  // Ensure encryptJson type available — session-manager already imports decryptJson only.
  if (!s.includes('import { decryptJson } from "@/lib/crypto"')) {
    throw new Error("unexpected crypto import");
  }
  s = mustReplaceOnce(
    s,
    `import { decryptJson } from "@/lib/crypto";`,
    `import { decryptJson, encryptJson } from "@/lib/crypto";
import type { syncSessionCyclesToDbWithDb } from "@/lib/poju/cycle-db-sync";`,
    "crypto+cycleSync type import",
  );

  // Fix: syncSessionCyclesToDbWithDb is a value export; import type of typeof needs the value.
  // Revert type-only and use Parameters from mutate opts instead.
  s = mustReplaceOnce(
    s,
    `import { decryptJson, encryptJson } from "@/lib/crypto";
import type { syncSessionCyclesToDbWithDb } from "@/lib/poju/cycle-db-sync";`,
    `import { decryptJson, type encryptJson } from "@/lib/crypto";`,
    "fix crypto import — use typeof via Mutate options inline",
  );

  // Actually encryptJson as type-only import of a function value is wrong in TS for typeof.
  // Simplest: import encryptJson as value (tree-shaken unused in prod path except type).
  s = mustReplaceOnce(
    s,
    `import { decryptJson, type encryptJson } from "@/lib/crypto";`,
    `import { decryptJson, encryptJson } from "@/lib/crypto";`,
    "value import encryptJson",
  );

  s = mustReplaceOnce(
    s,
    `export async function extendPOJUV4Session(
  sessionId: string,
  paymentId: string,
): Promise<POJUSessionState | null> {`,
    `export async function extendPOJUV4Session(
  sessionId: string,
  paymentId: string,
  /**
   * Test-only injects forwarded to mutatePOJUSession (P3-136/137).
   * Production callers omit this.
   */
  opts?: {
    encrypt?: typeof encryptJson;
    cycleSync?: typeof syncSessionCyclesToDbWithDb;
  },
): Promise<POJUSessionState | null> {`,
    "extend opts signature",
  );

  s = mustReplaceOnce(
    s,
    `  const result = await mutatePOJUSession(sessionId, {
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
  });`,
    `  const result = await mutatePOJUSession(
    sessionId,
    {
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
    },
    {
      ...(opts?.encrypt ? { encrypt: opts.encrypt } : {}),
      ...(opts?.cycleSync ? { cycleSync: opts.cycleSync } : {}),
    },
  );`,
    "extend pass test opts",
  );

  fs.writeFileSync(p, s);
  console.log("patched extend opts", p);
}
