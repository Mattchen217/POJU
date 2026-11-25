/**
 * Atomic finalization claim — binds required page fence versions before
 * final delivery. Same-generation invalidation that bumps any claimed fence
 * causes the claim to fail (TOCTOU closed).
 */

import type { ReportPageId } from "../orchestration/types";
import type { AuthorityPageClaimIdentity } from "./authority-page-read";
import { generationStoreKeys } from "./generation-store";
import {
  evalTxn,
  isMemoryAtomicAvailable,
  kvGet,
  runMemoryAtomic,
  trackBatch3Key,
  ttlSeconds,
} from "./kv-cas";
import { pageFenceKey } from "./page-fence";
import type {
  ActiveGenerationPointer,
  Batch3Result,
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
  status: "claimed";
  pages: FinalizationPageBinding[];
};

export function finalizationClaimKey(
  report_id: string,
  generation_id: string,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:finalization`;
}

/**
 * Lua: KEYS[1]=active, KEYS[2]=claim, KEYS[3..]=fence keys in page order.
 * ARGV[1]=expectGenId, ARGV[2]=expectEpoch, ARGV[3]=claimJson,
 * ARGV[4]=ttl, ARGV[5]=pageCount,
 * then per page: validity_rev, attempt_id, output_fingerprint, task_key
 */
const FINALIZE_LUA = `
local activeKey = KEYS[1]
local claimKey = KEYS[2]
local expectGenId = ARGV[1]
local expectEpoch = tonumber(ARGV[2])
local claimJson = ARGV[3]
local ttl = tonumber(ARGV[4])
local pageCount = tonumber(ARGV[5])

local cur = redis.call("GET", activeKey)
if cur == false or cur == nil then return -1 end
local ok, active = pcall(cjson.decode, cur)
if not ok or not active then return -1 end
if active.generation_id ~= expectGenId or tonumber(active.generation_epoch) ~= expectEpoch then
  return -1
end

local existing = redis.call("GET", claimKey)
if existing ~= false and existing ~= nil then
  local eok, prev = pcall(cjson.decode, existing)
  if eok and prev and prev.status == "claimed" then
    if prev.claim_id == cjson.decode(claimJson).claim_id then
      return 2
    end
    -- Same fence bindings → idempotent success; otherwise conflict
    local same = true
    if tonumber(prev.generation_epoch) ~= expectEpoch or prev.generation_id ~= expectGenId then
      same = false
    end
    if same and type(prev.pages) == "table" and #prev.pages == pageCount then
      for i = 1, pageCount do
        local p = prev.pages[i]
        local base = 5 + (i - 1) * 4
        local expectRev = tonumber(ARGV[base + 1])
        local expectAttempt = ARGV[base + 2]
        local expectFp = ARGV[base + 3]
        local expectTask = ARGV[base + 4]
        if not p or tonumber(p.validity_rev) ~= expectRev or p.attempt_id ~= expectAttempt
          or p.output_fingerprint ~= expectFp or p.task_key ~= expectTask then
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
end

for i = 1, pageCount do
  local fenceKey = KEYS[2 + i]
  local base = 5 + (i - 1) * 4
  local expectRev = tonumber(ARGV[base + 1])
  local expectAttempt = ARGV[base + 2]
  local expectFp = ARGV[base + 3]
  local expectTask = ARGV[base + 4]
  local fcur = redis.call("GET", fenceKey)
  if fcur == false or fcur == nil then return -2 end
  local fok, fence = pcall(cjson.decode, fcur)
  if not fok or not fence then return -2 end
  if fence.status ~= "committed" then return -3 end
  if tonumber(fence.validity_rev) ~= expectRev then return -3 end
  if fence.attempt_id ~= expectAttempt then return -3 end
  if fence.output_fingerprint ~= expectFp then return -3 end
  if fence.task_key ~= expectTask then return -3 end
  if tonumber(fence.generation_epoch) ~= expectEpoch then return -1 end
end

redis.call("SET", claimKey, claimJson, "EX", ttl)
return 1
`;

function mapFinalizeCode(code: number): Batch3Result<"created" | "idempotent"> {
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
  return {
    ok: false,
    code: "conflict",
    detail: `finalization refused: unknown lua code=${code}`,
  };
}

/**
 * Atomically verify required fences still match the read identities and seal
 * a finalization claim. Invalidation that bumps any fence causes failure.
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

  const claim: FinalizationClaim = {
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    generation_epoch: input.generation_epoch,
    claim_id: input.claim_id,
    claimed_at: new Date().toISOString(),
    status: "claimed",
    pages: input.pages,
  };

  const aKey = generationStoreKeys.activeKey(input.report_id);
  const cKey = finalizationClaimKey(input.report_id, input.generation_id);
  trackBatch3Key(aKey);
  trackBatch3Key(cKey);

  if (isMemoryAtomicAvailable()) {
    const ran = runMemoryAtomic((ops) => {
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

      const existing = ops.getJson(cKey) as FinalizationClaim | null;
      if (existing?.status === "claimed") {
        if (existing.claim_id === input.claim_id) {
          return { ok: true as const, claim: existing, mode: "idempotent" as const };
        }
        const same =
          existing.generation_id === input.generation_id.trim() &&
          existing.generation_epoch === input.generation_epoch &&
          existing.pages.length === input.pages.length &&
          existing.pages.every((p, i) => {
            const q = input.pages[i];
            return (
              p.page_id === q.page_id &&
              p.validity_rev === q.validity_rev &&
              p.attempt_id === q.attempt_id &&
              p.output_fingerprint === q.output_fingerprint &&
              p.task_key === q.task_key
            );
          });
        if (same) {
          return { ok: true as const, claim: existing, mode: "idempotent" as const };
        }
        return {
          ok: false as const,
          code: "conflict" as const,
          detail: "existing finalization claim with different bindings",
        };
      }

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
        if (
          fence.status !== "committed" ||
          fence.validity_rev !== page.validity_rev ||
          fence.attempt_id !== page.attempt_id ||
          fence.output_fingerprint !== page.output_fingerprint ||
          fence.task_key !== page.task_key ||
          fence.generation_epoch !== input.generation_epoch
        ) {
          return {
            ok: false as const,
            code: "stale_page" as const,
            detail: `fence no longer matches claim for ${page.page_id}`,
          };
        }
      }

      ops.setJson(cKey, claim, ttlSeconds());
      return { ok: true as const, claim, mode: "created" as const };
    });
    if (!ran.ok) return ran;
    if (!ran.value.ok) {
      return { ok: false, code: ran.value.code, detail: ran.value.detail };
    }
    return { ok: true, value: ran.value.claim };
  }

  const fenceKeys = input.pages.map((p) =>
    pageFenceKey(input.report_id, input.generation_id, p.page_id),
  );
  const args: string[] = [
    input.generation_id.trim(),
    String(input.generation_epoch),
    JSON.stringify(claim),
    String(ttlSeconds()),
    String(input.pages.length),
  ];
  for (const p of input.pages) {
    args.push(
      String(p.validity_rev),
      p.attempt_id,
      p.output_fingerprint,
      p.task_key,
    );
  }

  const evaled = await evalTxn(
    FINALIZE_LUA,
    [aKey, cKey, ...fenceKeys],
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
