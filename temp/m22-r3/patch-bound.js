const fs = require("fs");
const path = "D:/POJU/pojulife/lib/poju/decision-intake/freeze-bound-report.ts";
let s = fs.readFileSync(path, "utf8");

// Fix __createClaimOpsForTests.release to fail closed (no GET+DEL)
const oldRelease = `    async release(key, token) {
      if (typeof store.compareAndDelete === "function") {
        return store.compareAndDelete(key, token);
      }
      const existing = await store.get<{ token?: string }>(key);
      if (!existing || existing.token !== token) return false;
      await store.del(key);
      return true;
    },`;

const newRelease = `    async release(key, token) {
      if (typeof store.compareAndDelete === "function") {
        return store.compareAndDelete(key, token);
      }
      // M2.2-R3: never silently downgrade atomic ownership release to GET+DEL.
      throw new Error(
        "CLAIM_CAS_UNAVAILABLE: store provides no compareAndDelete; refusing non-atomic claim release",
      );
    },`;

if (!s.includes(oldRelease)) {
  console.error("release block not found");
  process.exit(1);
}
s = s.replace(oldRelease, newRelease);

// Also make expired residue cleanup in tryAcquire fail closed without compareAndDelete
// (optional but safer) — keep token-checked get+del only for expired residue is still
// a form of non-atomic. Max focused on compareAndDeleteClaim. Leave tryAcquire as-is
// when compareAndDelete exists; when missing, require compareAndDelete for expired clear too.
const oldExpired = `      if (existing && typeof existing.token === "string") {
        // Expired only: token-checked delete so we never wipe a racing new owner.
        if (
          typeof existing.expires_at === "number" &&
          existing.expires_at <= now
        ) {
          if (typeof store.compareAndDelete === "function") {
            await store.compareAndDelete(key, existing.token);
          } else {
            const again = await store.get<{ token?: string }>(key);
            if (again && again.token === existing.token) await store.del(key);
          }
        }
      }`;

const newExpired = `      if (existing && typeof existing.token === "string") {
        // Expired only: atomic token-checked delete (fail closed if CAS unavailable).
        if (
          typeof existing.expires_at === "number" &&
          existing.expires_at <= now
        ) {
          if (typeof store.compareAndDelete !== "function") {
            throw new Error(
              "CLAIM_CAS_UNAVAILABLE: cannot clear expired claim without compareAndDelete",
            );
          }
          await store.compareAndDelete(key, existing.token);
        }
      }`;

if (!s.includes(oldExpired)) {
  console.error("expired cleanup block not found");
  process.exit(1);
}
s = s.replace(oldExpired, newExpired);

// Add releaseClaimBeforePreHandoffReturn after releaseFreezeBoundReportClaim
if (!s.includes("releaseClaimBeforePreHandoffReturn")) {
  const marker = `export async function releaseFreezeBoundReportClaim(input: {
  claimKey: string;
  claimToken: string;
  deps?: FreezeBoundReportDeps;
}): Promise<boolean> {
  const claimOps = input.deps?.claimOps ?? defaultProcessLocalClaimOps;
  const result = await claimOps.release(input.claimKey, input.claimToken);
  return result !== false;
}`;
  const withHelper = marker + `

/**
 * M2.2-R3: release a successfully acquired claim before any pre-handoff early return.
 * If the request will not hand ownership to a running Final Delivery job, call this
 * with token CAS before returning so a subsequent valid request can acquire.
 */
export async function releaseClaimBeforePreHandoffReturn(input: {
  claimKey: string | null | undefined;
  claimToken: string | null | undefined;
  deps?: FreezeBoundReportDeps;
}): Promise<boolean> {
  if (!input.claimKey || !input.claimToken) return false;
  return releaseFreezeBoundReportClaim({
    claimKey: input.claimKey,
    claimToken: input.claimToken,
    deps: input.deps,
  });
}`;
  if (!s.includes(marker)) {
    console.error("releaseFreezeBoundReportClaim marker not found");
    process.exit(1);
  }
  s = s.replace(marker, withHelper);
}

fs.writeFileSync(path, s, "utf8");
console.log("patched freeze-bound-report.ts");
