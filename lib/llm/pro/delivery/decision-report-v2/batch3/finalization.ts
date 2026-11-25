/**
 * Atomic finalization claim — binds required page fence versions before
 * final delivery. Mutual exclusion with invalidation (R5/R6): once claimed,
 * invalidatePageAuthority refuses; once invalidated, claimFinalization fails.
 * Corrupt existing claim must not be overwritten (fail-closed).
 */

import { REPORT_PAGE_IDS } from "../orchestration";
import type { ReportPageId } from "../orchestration/types";
import type { AuthorityPageClaimIdentity } from "./authority-page-read";
import { inspectFinalizationClaimValue } from "./claim-inspect";
import {
  finalizationClaimKey,
  type FinalizationDeliveryStatus,
} from "./finalization-lock";
import {
  generationStoreKeys,
  readGeneration,
  transitionGenerationStatus,
} from "./generation-store";
import {
  evalTxn,
  isMemoryAtomicAvailable,
  kvGet,
  runMemoryAtomic,
  trackBatch3Key,
  ttlSeconds,
  casSet,
} from "./kv-cas";
import {
  cascadeActiveKey,
  cascadeOpKey,
} from "./cascade-operation";
import { pageFenceKey } from "./page-fence";
import type {
  ActiveGenerationPointer,
  Batch3Result,
  CascadeOperation,
  GenerationRecord,
  PageFence,
} from "./types";

export type FinalizationPageBinding = AuthorityPageClaimIdentity & {
  /** Content-verified authority output sealed into the claim. */
  sealed_output: unknown;
  outcome: string;
};

export type FinalizationClaim = {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  claim_id: string;
  claimed_at: string;
  status: FinalizationDeliveryStatus;
  pages: FinalizationPageBinding[];
  delivering_at?: string | null;
  delivered_at?: string | null;
  delivery_failed_at?: string | null;
  delivery_detail?: string | null;
};

export { finalizationClaimKey };

export function bindingsMatch(
  existing: FinalizationPageBinding[],
  next: FinalizationPageBinding[],
): boolean {
  if (existing.length !== next.length) return false;
  return existing.every((p, i) => {
    const q = next[i];
    return (
      p.page_id === q.page_id &&
      p.validity_rev === q.validity_rev &&
      p.attempt_id === q.attempt_id &&
      p.output_fingerprint === q.output_fingerprint &&
      p.task_key === q.task_key &&
      p.input_fingerprint === q.input_fingerprint
    );
  });
}

/** Formal page set must be complete+unique; Page07 may be conditional terminal. */
export function assertCompleteFormalPageSet(
  pages: FinalizationPageBinding[],
): Batch3Result<void> {
  const ids = pages.map((p) => p.page_id);
  const set = new Set(ids);
  if (set.size !== ids.length) {
    return { ok: false, code: "conflict", detail: "duplicate page in seal set" };
  }
  for (const req of REPORT_PAGE_IDS) {
    if (!set.has(req)) {
      return {
        ok: false,
        code: "conflict",
        detail: `seal missing formal page ${req}`,
      };
    }
  }
  if (ids.length !== REPORT_PAGE_IDS.length) {
    return {
      ok: false,
      code: "conflict",
      detail: "seal page set size mismatch vs REPORT_PAGE_IDS",
    };
  }
  // Page07: allow skipped_not_applicable / insufficient as legal terminals.
  const p07 = pages.find((p) => p.page_id === "07");
  if (p07) {
    const okOutcomes = new Set([
      "completed",
      "skipped_not_applicable",
      "skipped_insufficient_information",
      "insufficient_information",
    ]);
    if (!okOutcomes.has(p07.outcome)) {
      return {
        ok: false,
        code: "conflict",
        detail: `Page07 illegal seal outcome=${p07.outcome}`,
      };
    }
  }
  return { ok: true, value: undefined };
}

function fenceMatchesBinding(
  fence: PageFence,
  page: FinalizationPageBinding,
  generation_epoch: number,
): boolean {
  return (
    fence.status === "committed" &&
    fence.validity_rev === page.validity_rev &&
    fence.attempt_id === page.attempt_id &&
    fence.output_fingerprint === page.output_fingerprint &&
    fence.task_key === page.task_key &&
    fence.input_fingerprint === page.input_fingerprint &&
    fence.generation_epoch === generation_epoch
  );
}

/** Test hook: await before entering MemoryKv/Redis atomic claim. */
let beforeClaimAtomicHook: (() => Promise<void>) | null = null;

export function setBeforeClaimAtomicHookForTests(
  hook: (() => Promise<void>) | null,
): void {
  beforeClaimAtomicHook = hook;
}

/**
 * Lua: KEYS[1]=active, KEYS[2]=claim, KEYS[3]=cascadeActive, KEYS[4]=gen,
 *      KEYS[5..]=fence keys in page order.
 * ARGV[1]=expectReportId, ARGV[2]=expectGenId, ARGV[3]=expectEpoch,
 * ARGV[4]=claimJson, ARGV[5]=ttl, ARGV[6]=pageCount, ARGV[7]=claimId,
 * ARGV[8]=nowIso,
 * then per page: page_id, validity_rev, attempt_id, output_fingerprint, task_key, input_fingerprint
 *
 * Returns:
 *  1 created (+ gen → finalizing)
 *  2 idempotent (same seal / matching bindings)
 *  -1 stale_generation
 *  -2 fence missing
 *  -3 stale_page
 *  -4 existing claim different bindings
 *  -5 existing claim present but unusable
 *  -6 cascade_blocked
 */
export const FINALIZE_LUA = `
local activeKey = KEYS[1]
local claimKey = KEYS[2]
local cascadeActiveKey = KEYS[3]
local genKey = KEYS[4]
local expectReportId = ARGV[1]
local expectGenId = ARGV[2]
local expectEpoch = tonumber(ARGV[3])
local claimJson = ARGV[4]
local ttl = tonumber(ARGV[5])
local pageCount = tonumber(ARGV[6])
local claimId = ARGV[7]
local nowIso = ARGV[8]

if not expectEpoch or not ttl or not pageCount or type(expectReportId) ~= "string"
  or type(expectGenId) ~= "string" or type(claimId) ~= "string" then
  return -1
end

local cur = redis.call("GET", activeKey)
if cur == false or cur == nil then return -1 end
local ok, active = pcall(cjson.decode, cur)
if not ok or not active then return -1 end
if active.generation_id ~= expectGenId or tonumber(active.generation_epoch) ~= expectEpoch then
  return -1
end

-- Cascade gate inside Lua (no external pre-check race).
local cascIdCur = redis.call("GET", cascadeActiveKey)
if cascIdCur ~= false and cascIdCur ~= nil then
  local cascId = cascIdCur
  if type(cascIdCur) == "string" then
    local cok, decoded = pcall(cjson.decode, cascIdCur)
    if cok and type(decoded) == "string" then cascId = decoded end
    if cok and type(decoded) ~= "string" and type(decoded) ~= "table" then cascId = cascIdCur end
  end
  -- strip JSON quotes if stored as JSON string
  if type(cascId) == "string" then
    local q = string.match(cascId, '^"(.*)"$')
    if q then cascId = q end
  end
  if type(cascId) == "string" and #cascId > 0 then
    local opKey = "report-batch3:" .. expectReportId .. ":" .. expectGenId .. ":cascade:" .. cascId
    local opCur = redis.call("GET", opKey)
    if opCur ~= false and opCur ~= nil then
      local ook, op = pcall(cjson.decode, opCur)
      if not ook or type(op) ~= "table" then return -6 end
      if op.status == "running" or op.status == "failed_recoverable" then
        return -6
      end
    end
  end
end

-- Always verify fences against requested bindings (idempotent path included).
for i = 1, pageCount do
  local fenceKey = KEYS[4 + i]
  local base = 8 + (i - 1) * 6
  local expectPageId = ARGV[base + 1]
  local expectRev = tonumber(ARGV[base + 2])
  local expectAttempt = ARGV[base + 3]
  local expectFp = ARGV[base + 4]
  local expectTask = ARGV[base + 5]
  local expectInput = ARGV[base + 6]
  local fcur = redis.call("GET", fenceKey)
  if fcur == false or fcur == nil then return -2 end
  local fok, fence = pcall(cjson.decode, fcur)
  if not fok or not fence then return -2 end
  if fence.status ~= "committed" then return -3 end
  if fence.page_id ~= expectPageId then return -3 end
  if tonumber(fence.validity_rev) ~= expectRev then return -3 end
  if fence.attempt_id ~= expectAttempt then return -3 end
  if fence.output_fingerprint ~= expectFp then return -3 end
  if fence.task_key ~= expectTask then return -3 end
  if fence.input_fingerprint ~= expectInput then return -3 end
  if tonumber(fence.generation_epoch) ~= expectEpoch then return -1 end
end

local existing = redis.call("GET", claimKey)
if existing ~= false and existing ~= nil then
  local eok, prev = pcall(cjson.decode, existing)
  if not eok or type(prev) ~= "table" then
    return -5
  end
  local pst = prev.status
  if pst ~= "claimed" and pst ~= "sealed" and pst ~= "delivering"
    and pst ~= "delivered" and pst ~= "delivery_failed" then
    return -5
  end
  if type(prev.report_id) ~= "string" or type(prev.generation_id) ~= "string"
    or prev.claim_id == nil or type(prev.pages) ~= "table" then
    return -5
  end

  local same = true
  if prev.report_id ~= expectReportId then same = false end
  if tonumber(prev.generation_epoch) ~= expectEpoch or prev.generation_id ~= expectGenId then
    same = false
  end
  if same and #prev.pages == pageCount then
    for i = 1, pageCount do
      local p = prev.pages[i]
      local base = 8 + (i - 1) * 6
      local expectPageId = ARGV[base + 1]
      local expectRev = tonumber(ARGV[base + 2])
      local expectAttempt = ARGV[base + 3]
      local expectFp = ARGV[base + 4]
      local expectTask = ARGV[base + 5]
      local expectInput = ARGV[base + 6]
      if not p or p.page_id ~= expectPageId
        or tonumber(p.validity_rev) ~= expectRev or p.attempt_id ~= expectAttempt
        or p.output_fingerprint ~= expectFp or p.task_key ~= expectTask
        or p.input_fingerprint ~= expectInput then
        same = false
        break
      end
    end
  else
    same = false
  end

  if same then return 2 end
  return -4
end

-- Create seal + gen finalizing atomically
local gcur = redis.call("GET", genKey)
if gcur == false or gcur == nil then return -1 end
local gok, grec = pcall(cjson.decode, gcur)
if not gok or type(grec) ~= "table" then return -1 end
if grec.status ~= "active" then return -1 end
grec.status = "finalizing"
grec.updated_at = nowIso
redis.call("SET", genKey, cjson.encode(grec), "EX", ttl)
redis.call("SET", claimKey, claimJson, "EX", ttl)
return 1
`;

export function mapFinalizeCode(
  code: number,
): Batch3Result<"created" | "idempotent"> {
  if (code === 1) return { ok: true, value: "created" };
  if (code === 2) return { ok: true, value: "idempotent" };
  if (code === -1) {
    return {
      ok: false,
      code: "stale_generation",
      detail: "finalization refused: active generation mismatch",
    };
  }
  if (code === -2) {
    return {
      ok: false,
      code: "not_found",
      detail: "finalization refused: fence missing",
    };
  }
  if (code === -3) {
    return {
      ok: false,
      code: "stale_page",
      detail: "finalization refused: fence stale or version mismatch",
    };
  }
  if (code === -4) {
    return {
      ok: false,
      code: "conflict",
      detail: "finalization refused: existing claim with different bindings",
    };
  }
  if (code === -5) {
    return {
      ok: false,
      code: "conflict",
      detail:
        "finalization refused: existing claim unusable (fail-closed, no overwrite)",
    };
  }
  if (code === -6) {
    return {
      ok: false,
      code: "cascade_blocked",
      detail: "finalization refused: cascade running or failed_recoverable",
    };
  }
  return {
    ok: false,
    code: "conflict",
    detail: `finalization refused: unknown lua code=${code}`,
  };
}

/**
 * Atomically verify required fences still match the read identities and seal
 * a finalization claim. Invalidation that bumps any fence causes failure;
 * once sealed, invalidation is refused (finalization_locked).
 */
export async function claimFinalization(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  claim_id: string;
  pages: FinalizationPageBinding[];
}): Promise<Batch3Result<FinalizationClaim>> {
  if (input.pages.length === 0) {
    return {
      ok: false,
      code: "conflict",
      detail: "finalization requires at least one page binding",
    };
  }

  const complete = assertCompleteFormalPageSet(input.pages);
  if (!complete.ok) return complete;

  const claim: FinalizationClaim = {
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    generation_epoch: input.generation_epoch,
    claim_id: input.claim_id,
    claimed_at: new Date().toISOString(),
    status: "sealed",
    pages: input.pages,
  };

  const aKey = generationStoreKeys.activeKey(input.report_id);
  const cKey = finalizationClaimKey(input.report_id, input.generation_id);
  trackBatch3Key(aKey);
  trackBatch3Key(cKey);

  // Barrier hook MUST be immediately before the atomic section (no await between).
  if (beforeClaimAtomicHook) {
    await beforeClaimAtomicHook();
  }

  if (isMemoryAtomicAvailable()) {
    const ran = runMemoryAtomic((ops) => {
      // Cascade gate inside atomic — keeps Claim×Invalidate barrier fair.
      const cascadeId = ops.getJson(
        cascadeActiveKey(input.report_id, input.generation_id),
      ) as string | null;
      if (cascadeId) {
        const cop = ops.getJson(
          cascadeOpKey(input.report_id, input.generation_id, cascadeId),
        ) as CascadeOperation | null;
        if (
          cop &&
          (cop.status === "running" || cop.status === "failed_recoverable")
        ) {
          return {
            ok: false as const,
            code: "cascade_incomplete" as const,
            detail: `finalization refused: cascade ${cop.operation_id} status=${cop.status}`,
          };
        }
      }

      const active = ops.getJson(aKey) as ActiveGenerationPointer | null;
      if (
        !active ||
        active.generation_id !== input.generation_id.trim() ||
        active.generation_epoch !== input.generation_epoch
      ) {
        return {
          ok: false as const,
          code: "stale_generation" as const,
          detail: "active mismatch at finalization",
        };
      }

      // Re-validate fences even on idempotent retry — never bypass.
      for (const page of input.pages) {
        const fKey = pageFenceKey(
          input.report_id,
          input.generation_id,
          page.page_id,
        );
        trackBatch3Key(fKey);
        const fence = ops.getJson(fKey) as PageFence | null;
        if (!fence) {
          return {
            ok: false as const,
            code: "not_found" as const,
            detail: `fence missing for ${page.page_id}`,
          };
        }
        if (!fenceMatchesBinding(fence, page, input.generation_epoch)) {
          return {
            ok: false as const,
            code: "stale_page" as const,
            detail: `fence no longer matches claim for ${page.page_id}`,
          };
        }
      }

      const existingRaw = ops.getJson(cKey);
      const inspect = inspectFinalizationClaimValue(existingRaw);
      if (inspect.kind === "unusable") {
        return {
          ok: false as const,
          code: "conflict" as const,
          detail: `existing finalization claim unusable: ${inspect.reason}`,
        };
      }
      if (inspect.kind === "claimed" || inspect.kind === "unlocked") {
        const existing = existingRaw as FinalizationClaim;
        if (
          existing.report_id === input.report_id.trim() &&
          existing.generation_id === input.generation_id.trim() &&
          existing.generation_epoch === input.generation_epoch &&
          bindingsMatch(existing.pages, input.pages)
        ) {
          return {
            ok: true as const,
            claim: existing,
            mode: "idempotent" as const,
          };
        }
        return {
          ok: false as const,
          code: "conflict" as const,
          detail: "existing finalization claim with different bindings",
        };
      }

      const gKey = generationStoreKeys.genKey(
        input.report_id,
        input.generation_id,
      );
      trackBatch3Key(gKey);
      const grec = ops.getJson(gKey) as GenerationRecord | null;
      if (!grec || grec.status !== "active") {
        return {
          ok: false as const,
          code: "stale_generation" as const,
          detail: `generation status=${grec?.status ?? "missing"} — need active to seal`,
        };
      }
      ops.setJson(gKey, {
        ...grec,
        status: "finalizing",
        updated_at: claim.claimed_at,
      });
      ops.setJson(cKey, claim, ttlSeconds());
      return { ok: true as const, claim, mode: "created" as const };
    });
    if (!ran.ok) return ran;
    if (!ran.value.ok) {
      return { ok: false, code: ran.value.code, detail: ran.value.detail };
    }
    return { ok: true, value: ran.value.claim };
  }

  const cascAKey = cascadeActiveKey(input.report_id, input.generation_id);
  const gKey = generationStoreKeys.genKey(
    input.report_id,
    input.generation_id,
  );
  trackBatch3Key(cascAKey);
  trackBatch3Key(gKey);

  const fenceKeys = input.pages.map((p) =>
    pageFenceKey(input.report_id, input.generation_id, p.page_id),
  );
  const args: string[] = [
    input.report_id.trim(),
    input.generation_id.trim(),
    String(input.generation_epoch),
    JSON.stringify(claim),
    String(ttlSeconds()),
    String(input.pages.length),
    input.claim_id,
    claim.claimed_at,
  ];
  for (const p of input.pages) {
    args.push(
      p.page_id,
      String(p.validity_rev),
      p.attempt_id,
      p.output_fingerprint,
      p.task_key,
      p.input_fingerprint,
    );
  }

  const evaled = await evalTxn(
    FINALIZE_LUA,
    [aKey, cKey, cascAKey, gKey, ...fenceKeys],
    args,
  );
  if (!evaled.ok) return evaled;
  const code = Number(evaled.value);
  if (!Number.isFinite(code)) {
    return {
      ok: false,
      code: "conflict",
      detail: `finalization non-numeric lua=${String(evaled.value)}`,
    };
  }
  const mapped = mapFinalizeCode(code);
  if (!mapped.ok) return mapped;
  if (mapped.value === "idempotent") {
    const existing = await kvGet<FinalizationClaim>(cKey);
    if (!existing.ok) return existing;
    if (existing.value) return { ok: true, value: existing.value };
  }
  return { ok: true, value: claim };
}

export async function readFinalizationClaim(
  report_id: string,
  generation_id: string,
): Promise<Batch3Result<FinalizationClaim | null>> {
  return kvGet<FinalizationClaim>(
    finalizationClaimKey(report_id, generation_id),
  );
}

/** Test helper: expose whether a page id is in a claim. */
export function claimIncludesPage(
  claim: FinalizationClaim,
  page_id: ReportPageId,
): boolean {
  return claim.pages.some((p) => p.page_id === page_id);
}

export async function markFinalizationDelivering(
  report_id: string,
  generation_id: string,
  generation_epoch?: number,
): Promise<Batch3Result<FinalizationClaim>> {
  const cur = await readFinalizationClaim(report_id, generation_id);
  if (!cur.ok) return cur;
  if (!cur.value) {
    return { ok: false, code: "not_found", detail: "no seal to deliver" };
  }
  const st = cur.value.status;
  if (st === "delivering" || st === "delivered") {
    return { ok: true, value: cur.value };
  }
  if (st !== "sealed" && st !== "claimed" && st !== "delivery_failed") {
    return {
      ok: false,
      code: "conflict",
      detail: `cannot start delivery from status=${st}`,
    };
  }
  const epoch = generation_epoch ?? cur.value.generation_epoch;
  // delivery_failed → finalizing before resume (Claim ↔ Generation closed loop).
  const gen = await readGeneration(report_id, generation_id);
  if (!gen.ok) return gen;
  if (gen.value?.status === "delivery_failed") {
    const restored = await transitionGenerationStatus({
      report_id,
      generation_id,
      generation_epoch: epoch,
      to: "finalizing",
    });
    if (!restored.ok) return restored;
  }
  const next: FinalizationClaim = {
    ...cur.value,
    status: "delivering",
    delivering_at: new Date().toISOString(),
  };
  const saved = await casSet(
    finalizationClaimKey(report_id, generation_id),
    JSON.stringify(cur.value),
    next,
  );
  if (!saved.ok) return saved;
  return { ok: true, value: next };
}

export async function markFinalizationDelivered(
  report_id: string,
  generation_id: string,
  generation_epoch: number,
): Promise<Batch3Result<FinalizationClaim>> {
  const cur = await readFinalizationClaim(report_id, generation_id);
  if (!cur.ok) return cur;
  if (!cur.value) {
    return { ok: false, code: "not_found", detail: "no seal" };
  }
  if (cur.value.status === "delivered") {
    return { ok: true, value: cur.value };
  }
  if (
    cur.value.status !== "delivering" &&
    cur.value.status !== "sealed" &&
    cur.value.status !== "claimed"
  ) {
    return {
      ok: false,
      code: "conflict",
      detail: `cannot mark delivered from ${cur.value.status}`,
    };
  }
  const next: FinalizationClaim = {
    ...cur.value,
    status: "delivered",
    delivered_at: new Date().toISOString(),
  };
  const saved = await casSet(
    finalizationClaimKey(report_id, generation_id),
    JSON.stringify(cur.value),
    next,
  );
  if (!saved.ok) return saved;
  const genDone = await transitionGenerationStatus({
    report_id,
    generation_id,
    generation_epoch,
    to: "completed",
  });
  if (!genDone.ok) {
    return {
      ok: false,
      code: genDone.code,
      detail: `claim delivered but generation transition failed: ${genDone.detail}`,
    };
  }
  return { ok: true, value: next };
}

export async function markFinalizationDeliveryFailed(
  report_id: string,
  generation_id: string,
  generation_epoch: number,
  detail: string,
): Promise<Batch3Result<FinalizationClaim>> {
  const cur = await readFinalizationClaim(report_id, generation_id);
  if (!cur.ok) return cur;
  if (!cur.value) {
    return { ok: false, code: "not_found", detail: "no seal" };
  }
  if (cur.value.status === "delivered") {
    return {
      ok: false,
      code: "conflict",
      detail: "already delivered",
    };
  }
  const next: FinalizationClaim = {
    ...cur.value,
    status: "delivery_failed",
    delivery_failed_at: new Date().toISOString(),
    delivery_detail: detail,
  };
  const saved = await casSet(
    finalizationClaimKey(report_id, generation_id),
    JSON.stringify(cur.value),
    next,
  );
  if (!saved.ok) return saved;
  const genFail = await transitionGenerationStatus({
    report_id,
    generation_id,
    generation_epoch,
    to: "delivery_failed",
  });
  if (!genFail.ok) {
    return {
      ok: false,
      code: genFail.code,
      detail: `claim delivery_failed but generation transition failed: ${genFail.detail}`,
    };
  }
  return { ok: true, value: next };
}
