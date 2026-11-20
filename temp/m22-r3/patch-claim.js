const fs = require("fs");
const path = "D:/POJU/pojulife/lib/poju/decision-intake/freeze-report-claim.ts";
let s = fs.readFileSync(path, "utf8");

// 1) Add ClaimCasUnavailableError + regenerate helper after imports / types area
if (!s.includes("ClaimCasUnavailableError")) {
  s = s.replace(
    'import { kv, KV_TTL } from "@/lib/kv/client";',
    `import { kv, KV_TTL } from "@/lib/kv/client";

/** Typed fail-closed error when atomic CAS delete is unavailable. */
export class ClaimCasUnavailableError extends Error {
  readonly code = "CLAIM_CAS_UNAVAILABLE" as const;
  constructor(
    message = "Atomic compare-and-delete unavailable; refusing non-atomic claim release",
  ) {
    super(message);
    this.name = "ClaimCasUnavailableError";
  }
}`
  );
}

// 2) Replace compareAndDeleteClaim — remove GET+DEL fallback
const oldCas = `export async function compareAndDeleteClaim(
  store: FreezeReportClaimKv,
  key: string,
  token: string,
): Promise<boolean> {
  if (typeof store.compareAndDelete === "function") {
    return store.compareAndDelete(key, token);
  }
  if (typeof store.eval === "function") {
    try {
      const result = await store.eval(CAS_DELETE_LUA, [key], [token]);
      return result === 1 || result === true;
    } catch {
      /* fall through to get+check+del */
    }
  }
  // Single-threaded fallback (tests / MemoryKv duck type without method).
  const existing = await store.get<FreezeReportClaimRecord>(key);
  if (!existing || existing.token !== token) return false;
  await store.del(key);
  return true;
}`;

const newCas = `export async function compareAndDeleteClaim(
  store: FreezeReportClaimKv,
  key: string,
  token: string,
): Promise<boolean> {
  if (typeof store.compareAndDelete === "function") {
    return store.compareAndDelete(key, token);
  }
  if (typeof store.eval === "function") {
    const result = await store.eval(CAS_DELETE_LUA, [key], [token]);
    return result === 1 || result === true;
  }
  // M2.2-R3: never silently downgrade atomic ownership release to GET+DEL.
  throw new ClaimCasUnavailableError(
    \`compareAndDeleteClaim: store provides neither compareAndDelete nor eval for key \${key}\`,
  );
}`;

if (!s.includes(oldCas)) {
  console.error("compareAndDeleteClaim block not found exactly");
  // try softer match
  if (!s.includes("fall through to get+check+del")) {
    console.error("fallback marker missing — already patched?");
  } else {
    process.exit(1);
  }
} else {
  s = s.replace(oldCas, newCas);
}

// 3) Add tryReleaseClaimForRegenerate before newFreezeReportClaimToken (or at end)
if (!s.includes("tryReleaseClaimForRegenerate")) {
  const helper = `
/**
 * M2.2-R3 Regenerate claim release: only the original owner's token may CAS-delete.
 * Never force-delete another execution context's claim.
 * If ownership cannot be proven while a claim is held → fail closed.
 */
export type RegenerateClaimReleaseResult =
  | { ok: true; released: boolean }
  | { ok: false; code: "CLAIM_OWNED_BY_OTHER"; error: string };

export async function tryReleaseClaimForRegenerate(input: {
  claimOps: FreezeReportClaimOps;
  claimKey: string;
  /** Original owner's token from the prior Final Delivery job input, if known. */
  ownerToken: string | null | undefined;
}): Promise<RegenerateClaimReleaseResult> {
  const held = input.claimOps.load
    ? await input.claimOps.load(input.claimKey)
    : null;
  if (!held) {
    return { ok: true, released: false };
  }
  if (!input.ownerToken) {
    return {
      ok: false,
      code: "CLAIM_OWNED_BY_OTHER",
      error:
        "Regenerate cannot prove claim ownership; fail closed until lease expiry",
    };
  }
  const released = await input.claimOps.release(
    input.claimKey,
    input.ownerToken,
  );
  if (!released) {
    return {
      ok: false,
      code: "CLAIM_OWNED_BY_OTHER",
      error:
        "Regenerate token does not own the active claim; fail closed (will not steal)",
    };
  }
  return { ok: true, released: true };
}
`;
  s = s.replace(
    "export function newFreezeReportClaimToken(): string {",
    helper + "\nexport function newFreezeReportClaimToken(): string {"
  );
}

fs.writeFileSync(path, s, "utf8");
console.log("patched freeze-report-claim.ts");
