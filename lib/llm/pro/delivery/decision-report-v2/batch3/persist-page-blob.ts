/**
 * Persist Batch2 page blob only while the page fence still matches the
 * committed authority (same atomic section as the fence read).
 *
 * Lua return codes (fail-closed — no ungated fallback write):
 *   1  = fence verified + blob written
 *  -1  = fence missing / undecodable
 *  -2  = fence not committed or attempt/rev/fp mismatch
 *  -3  = existing blob already at higher validity_rev
 *  -4  = authority output missing / fingerprint mismatch
 *  any other / NaN / eval failure → refuse write
 */

import {
  pageBlobKey,
  type PageBlob,
} from "../batch2/job-store";
import type { ReportPageId, ReportPageRuntimeState } from "../orchestration/types";
import { authOutputKey, type AuthorityPageOutput } from "./auth-output";
import {
  evalTxn,
  isMemoryAtomicAvailable,
  runMemoryAtomic,
  trackBatch3Key,
  ttlSeconds,
} from "./kv-cas";
import { pageFenceKey } from "./page-fence";
import type { Batch3FailCode, Batch3Result, PageFence } from "./types";

/** Lua / Memory persist codes. */
export const PERSIST_BLOB_LUA_OK = 1;
export const PERSIST_BLOB_LUA_FENCE_MISSING = -1;
export const PERSIST_BLOB_LUA_FENCE_STALE = -2;
export const PERSIST_BLOB_LUA_BLOB_NEWER = -3;
export const PERSIST_BLOB_LUA_AUTH_MISSING = -4;

const PERSIST_BLOB_LUA = `
local fenceKey = KEYS[1]
local pageKey = KEYS[2]
local authKey = KEYS[3]
local expectRev = tonumber(ARGV[1])
local expectAttempt = ARGV[2]
local expectFp = ARGV[3]
local nextBlobJson = ARGV[4]
local ttl = tonumber(ARGV[5])

local fcur = redis.call("GET", fenceKey)
if fcur == false or fcur == nil then return -1 end
local ok, fence = pcall(cjson.decode, fcur)
if not ok or not fence then return -1 end
if fence.status ~= "committed" then return -2 end
if tonumber(fence.validity_rev) ~= expectRev then return -2 end
if fence.attempt_id ~= expectAttempt then return -2 end
if fence.output_fingerprint ~= expectFp then return -2 end

local acur = redis.call("GET", authKey)
if acur == false or acur == nil then return -4 end
local aok, auth = pcall(cjson.decode, acur)
if not aok or not auth then return -4 end
if auth.output_fingerprint ~= expectFp then return -4 end
if tonumber(auth.validity_rev) ~= expectRev then return -4 end

local pcur = redis.call("GET", pageKey)
if pcur ~= false and pcur ~= nil then
  local pok, cur = pcall(cjson.decode, pcur)
  if pok and cur and tonumber(cur.validity_rev or 0) > expectRev then
    return -3
  end
  local nextBlob = cjson.decode(nextBlobJson)
  if pok and cur then
    nextBlob.rev = (tonumber(cur.rev) or 0) + 1
  else
    nextBlob.rev = 1
  end
  redis.call("SET", pageKey, cjson.encode(nextBlob), "EX", ttl)
else
  local nextBlob = cjson.decode(nextBlobJson)
  nextBlob.rev = 1
  redis.call("SET", pageKey, cjson.encode(nextBlob), "EX", ttl)
end
return 1
`;

type PersistFail = {
  ok: false;
  code: Exclude<Batch3FailCode, "success">;
  detail: string;
};

/** Map Lua numeric codes — unknown / NaN always fail closed. */
export function mapPersistBlobLuaCode(code: number): PersistFail | { ok: true } {
  if (code === PERSIST_BLOB_LUA_OK) return { ok: true };
  if (code === PERSIST_BLOB_LUA_FENCE_MISSING) {
    return {
      ok: false,
      code: "not_found",
      detail: "persist blob refused: fence missing or undecodable (lua=-1)",
    };
  }
  if (code === PERSIST_BLOB_LUA_FENCE_STALE) {
    return {
      ok: false,
      code: "stale_page",
      detail: "persist blob refused: fence stale or mismatch (lua=-2)",
    };
  }
  if (code === PERSIST_BLOB_LUA_BLOB_NEWER) {
    return {
      ok: false,
      code: "stale_page",
      detail: "persist blob refused: blob already at higher validity_rev (lua=-3)",
    };
  }
  if (code === PERSIST_BLOB_LUA_AUTH_MISSING) {
    return {
      ok: false,
      code: "not_found",
      detail: "persist blob refused: authority output missing/mismatch (lua=-4)",
    };
  }
  return {
    ok: false,
    code: "conflict",
    detail: `persist blob refused: unknown lua code=${String(code)}`,
  };
}

/** Test hook: return true to inject a persist failure after authority commit. */
let persistFailHook: (() => boolean) | null = null;

/** Test hook: force Redis-path eval result (exercises return-code mapping). */
let persistEvalOverride:
  | (() => Batch3Result<unknown> | Promise<Batch3Result<unknown>>)
  | null = null;

export function setPersistPageBlobFailHookForTests(
  hook: (() => boolean) | null,
): void {
  persistFailHook = hook;
}

export function setPersistPageBlobEvalOverrideForTests(
  hook:
    | (() => Batch3Result<unknown> | Promise<Batch3Result<unknown>>)
    | null,
): void {
  persistEvalOverride = hook;
}

/**
 * Gate page-blob write on live committed fence matching validity_rev / attempt / fp
 * and a matching Authority Output. No ungated fallback write path.
 */
export async function persistPageBlobUnderCommittedFence(input: {
  report_id: string;
  generation_id: string;
  page_id: ReportPageId;
  validity_rev: number;
  attempt_id: string;
  output_fingerprint: string;
  state: ReportPageRuntimeState;
  output: unknown;
}): Promise<Batch3Result<{ rev: number }>> {
  if (persistFailHook?.()) {
    return {
      ok: false,
      code: "kv_write_failed",
      detail: "injected page blob persist failure (authority remains committed)",
    };
  }

  const fKey = pageFenceKey(input.report_id, input.generation_id, input.page_id);
  const pKey = pageBlobKey(input.report_id, input.generation_id, input.page_id);
  const aKey = authOutputKey(input.report_id, input.generation_id, input.page_id);
  trackBatch3Key(fKey);
  trackBatch3Key(pKey);
  trackBatch3Key(aKey);

  if (isMemoryAtomicAvailable() && !persistEvalOverride) {
    const ran = runMemoryAtomic((ops) => {
      const fence = ops.getJson(fKey) as PageFence | null;
      if (!fence) {
        return {
          ok: false as const,
          code: "not_found" as const,
          detail: "fence missing at blob persist",
        };
      }
      if (
        fence.status !== "committed" ||
        fence.validity_rev !== input.validity_rev ||
        fence.attempt_id !== input.attempt_id ||
        fence.output_fingerprint !== input.output_fingerprint
      ) {
        return {
          ok: false as const,
          code: "stale_page" as const,
          detail: "fence no longer matches committed authority at blob persist",
        };
      }
      const auth = ops.getJson(aKey) as AuthorityPageOutput | null;
      if (
        !auth ||
        auth.output_fingerprint !== input.output_fingerprint ||
        auth.validity_rev !== input.validity_rev
      ) {
        return {
          ok: false as const,
          code: "not_found" as const,
          detail: "authority output missing/mismatch at blob persist",
        };
      }
      const cur = ops.getJson(pKey) as PageBlob | null;
      if (cur && (cur.validity_rev ?? 0) > input.validity_rev) {
        return {
          ok: false as const,
          code: "stale_page" as const,
          detail: `blob already at higher validity_rev ${cur.validity_rev}`,
        };
      }
      const next: PageBlob = {
        rev: (cur?.rev ?? 0) + 1,
        state: input.state,
        output: input.output,
        repair: null,
        validity_rev: input.validity_rev,
        authority_output_fingerprint: input.output_fingerprint,
      };
      ops.setJson(pKey, next, ttlSeconds());
      return { ok: true as const, rev: next.rev };
    });
    if (!ran.ok) return ran;
    if (!ran.value.ok) {
      return { ok: false, code: ran.value.code, detail: ran.value.detail };
    }
    return { ok: true, value: { rev: ran.value.rev } };
  }

  const blobWithoutRev = {
    state: input.state,
    output: input.output,
    repair: null,
    validity_rev: input.validity_rev,
    authority_output_fingerprint: input.output_fingerprint,
  };

  const evaled = persistEvalOverride
    ? await persistEvalOverride()
    : await evalTxn(
        PERSIST_BLOB_LUA,
        [fKey, pKey, aKey],
        [
          String(input.validity_rev),
          input.attempt_id,
          input.output_fingerprint,
          JSON.stringify(blobWithoutRev),
          String(ttlSeconds()),
        ],
      );

  if (!evaled.ok) {
    // Lua/KV failure — refuse; never fall back to ungated Page Blob write.
    return {
      ok: false,
      code: evaled.code,
      detail: `persist blob refused: eval failed — ${evaled.detail}`,
    };
  }

  const code = Number(evaled.value);
  if (!Number.isFinite(code)) {
    return {
      ok: false,
      code: "conflict",
      detail: `persist blob refused: non-numeric lua result=${String(evaled.value)}`,
    };
  }
  const mapped = mapPersistBlobLuaCode(code);
  if (!mapped.ok) return mapped;
  return { ok: true, value: { rev: 1 } };
}

export function authOutputTrackKey(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): string {
  return authOutputKey(report_id, generation_id, page_id);
}

export type { AuthorityPageOutput };
