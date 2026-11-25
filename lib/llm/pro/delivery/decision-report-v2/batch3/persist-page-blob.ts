/**
 * Persist Batch2 page blob only while the page fence still matches the
 * committed authority (same atomic section as the fence read).
 */

import {
  pageBlobKey,
  type PageBlob,
  writePageBlobWithValidity,
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
import type { Batch3Result, PageFence } from "./types";

const PERSIST_BLOB_LUA = `
local fenceKey = KEYS[1]
local pageKey = KEYS[2]
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

/**
 * Gate page-blob write on live committed fence matching validity_rev / attempt / fp.
 * Closes the race where invalidation lands between authority commit and blob persist.
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
  const fKey = pageFenceKey(input.report_id, input.generation_id, input.page_id);
  const pKey = pageBlobKey(input.report_id, input.generation_id, input.page_id);
  trackBatch3Key(fKey);
  trackBatch3Key(pKey);

  if (isMemoryAtomicAvailable()) {
    const ran = runMemoryAtomic((ops) => {
      const fence = ops.getJson(fKey) as PageFence | null;
      if (
        !fence ||
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
  const evaled = await evalTxn(
    PERSIST_BLOB_LUA,
    [fKey, pKey],
    [
      String(input.validity_rev),
      input.attempt_id,
      input.output_fingerprint,
      JSON.stringify(blobWithoutRev),
      String(ttlSeconds()),
    ],
  );
  if (!evaled.ok) return evaled;
  const code = Number(evaled.value);
  if (code === 1) {
    // Fallback path already wrote; return synthetic rev
    return { ok: true, value: { rev: 1 } };
  }
  if (code === -2 || code === -3) {
    return {
      ok: false,
      code: "stale_page",
      detail: `persist blob fence gate lua=${code}`,
    };
  }
  // Lua unavailable / decode issues — fall back to ordered writePageBlobWithValidity
  // which still refuses lower validity_rev.
  const written = await writePageBlobWithValidity({
    report_id: input.report_id,
    generation_id: input.generation_id,
    page_id: input.page_id,
    state: input.state,
    output: input.output,
    validity_rev: input.validity_rev,
    authority_output_fingerprint: input.output_fingerprint,
  });
  if (!written.ok) {
    return {
      ok: false,
      code: written.code === "stale_page_write" ? "stale_page" : "kv_write_failed",
      detail: written.detail,
    };
  }
  return { ok: true, value: { rev: written.value } };
}

export function authOutputTrackKey(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): string {
  return authOutputKey(report_id, generation_id, page_id);
}

export type { AuthorityPageOutput };
