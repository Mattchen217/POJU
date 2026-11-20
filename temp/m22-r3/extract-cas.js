const fs = require("fs");

// Create shared CAS module without server-only
const casPath = "D:/POJU/pojulife/lib/poju/decision-intake/freeze-report-claim-cas.ts";
fs.writeFileSync(
  casPath,
  `/**
 * M2.2-R3 — Atomic claim compare-and-delete (fail closed).
 * Shared by server claim ops and tests; no server-only import.
 */

export class ClaimCasUnavailableError extends Error {
  readonly code = "CLAIM_CAS_UNAVAILABLE" as const;
  constructor(
    message = "Atomic compare-and-delete unavailable; refusing non-atomic claim release",
  ) {
    super(message);
    this.name = "ClaimCasUnavailableError";
  }
}

export type FreezeReportClaimCasStore = {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean },
  ) => Promise<"OK" | null>;
  del: (...keys: string[]) => Promise<number>;
  compareAndDelete?: (key: string, expectedToken: string) => Promise<boolean>;
  eval?: (
    script: string,
    keys: string[],
    args: string[],
  ) => Promise<unknown>;
};

export const CAS_DELETE_LUA = \`
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if type(raw) ~= 'string' then
  raw = tostring(raw)
end
if raw == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
local ok, obj = pcall(cjson.decode, raw)
if ok and type(obj) == 'table' and tostring(obj['token']) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
\`;

/**
 * Token-checked compare-and-delete.
 * Never silently downgrades to GET+DEL when atomic CAS is unavailable.
 */
export async function compareAndDeleteClaim(
  store: FreezeReportClaimCasStore,
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
  throw new ClaimCasUnavailableError(
    \`compareAndDeleteClaim: store provides neither compareAndDelete nor eval for key \${key}\`,
  );
}
`,
  "utf8",
);
console.log("wrote freeze-report-claim-cas.ts");

// Update freeze-report-claim.ts to import from cas module
const path = "D:/POJU/pojulife/lib/poju/decision-intake/freeze-report-claim.ts";
let s = fs.readFileSync(path, "utf8");

// Remove local ClaimCasUnavailableError class if present
s = s.replace(
  /\/\*\* Typed fail-closed error when atomic CAS delete is unavailable\. \*\/\r?\nexport class ClaimCasUnavailableError extends Error \{[\s\S]*?\n\}\r?\n/,
  "",
);

// Remove local CAS_DELETE_LUA and compareAndDeleteClaim — re-export from cas
if (s.includes("const CAS_DELETE_LUA")) {
  s = s.replace(
    /const CAS_DELETE_LUA = `[\s\S]*?`;\r?\n\r?\n/,
    "",
  );
}

// Replace compareAndDeleteClaim function with re-export import
const casFnStart = s.indexOf("export async function compareAndDeleteClaim");
if (casFnStart >= 0) {
  const casFnEnd = s.indexOf("\nexport function freezeReportClaimKey", casFnStart);
  // actually order may be freezeReportClaimKey before compareAndDeleteClaim
}

// Simpler: add import and replace function body block
if (!s.includes("freeze-report-claim-cas")) {
  s = s.replace(
    'import { kv, KV_TTL } from "@/lib/kv/client";',
    `import { kv, KV_TTL } from "@/lib/kv/client";
import {
  ClaimCasUnavailableError,
  compareAndDeleteClaim,
  CAS_DELETE_LUA,
} from "@/lib/poju/decision-intake/freeze-report-claim-cas";

export { ClaimCasUnavailableError, compareAndDeleteClaim };`,
  );
}

// Remove the local compareAndDeleteClaim function definition if still present
const re = /export async function compareAndDeleteClaim\([\s\S]*?^}\r?\n/m;
if (re.test(s)) {
  s = s.replace(re, "");
  console.log("removed local compareAndDeleteClaim");
}

// Remove unused CAS_DELETE_LUA if still referenced only by removed fn — import still has it unused
// Drop CAS_DELETE_LUA from import if unused
if (!s.includes("CAS_DELETE_LUA")) {
  // ok
} else if (!s.match(/CAS_DELETE_LUA[^.]/)) {
  s = s.replace(",\n  CAS_DELETE_LUA", "");
}
// Actually createFreezeReportClaimOps uses compareAndDeleteClaim - good.
// CAS_DELETE_LUA may be unused in this file now
s = s.replace(
  `import {
  ClaimCasUnavailableError,
  compareAndDeleteClaim,
  CAS_DELETE_LUA,
} from "@/lib/poju/decision-intake/freeze-report-claim-cas";`,
  `import {
  ClaimCasUnavailableError,
  compareAndDeleteClaim,
} from "@/lib/poju/decision-intake/freeze-report-claim-cas";`,
);

fs.writeFileSync(path, s, "utf8");
console.log("updated freeze-report-claim.ts");

// Fix C3 test to import from cas module
const testPath = "D:/POJU/pojulife/scripts/test-m2-2-freeze-report-binding.ts";
let t = fs.readFileSync(testPath, "utf8");
t = t.replace(
  `    const { compareAndDeleteClaim, ClaimCasUnavailableError } = await import(
      "../lib/poju/decision-intake/freeze-report-claim"
    );`,
  `    const { compareAndDeleteClaim, ClaimCasUnavailableError } = await import(
      "../lib/poju/decision-intake/freeze-report-claim-cas"
    );`,
);
fs.writeFileSync(testPath, t, "utf8");
console.log("updated C3 import");
