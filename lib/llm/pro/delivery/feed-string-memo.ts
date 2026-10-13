/**
 * Per-job memo for expensive deterministic prompt strings.
 *
 * Thesis / inventory are computed in Node (cheap vs LLM) but rebuilt on every
 * page/gun today. Memoizing the *string* avoids N× rebuild CPU and keeps the
 * same prefix bytes for OpenRouter prefix-cache affinity within a job.
 *
 * This does NOT mean "0 tokens to the model" — each LLM call that needs the
 * block must still include it in the user message (unless pageFeedFlags omits it).
 */

type MemoEntry = {
  structured_inventory?: string;
  chart_thesis_block?: string;
  expires_at: number;
};

const TTL_MS = 45 * 60 * 1000;
const store = new Map<string, MemoEntry>();

function touch(job_id: string): MemoEntry {
  const id = job_id.trim();
  const now = Date.now();
  const prev = store.get(id);
  if (prev && prev.expires_at > now) {
    prev.expires_at = now + TTL_MS;
    return prev;
  }
  const next: MemoEntry = { expires_at: now + TTL_MS };
  store.set(id, next);
  return next;
}

/** Drop stale entries opportunistically (small map). */
function sweep(): void {
  if (store.size < 64) return;
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expires_at <= now) store.delete(k);
  }
}

export function getMemoizedStructuredInventory(job_id: string): string | undefined {
  const e = store.get(job_id.trim());
  if (!e || e.expires_at <= Date.now()) return undefined;
  return e.structured_inventory;
}

export function setMemoizedStructuredInventory(job_id: string, value: string): void {
  sweep();
  const e = touch(job_id);
  e.structured_inventory = value;
}

export function getMemoizedChartThesisBlock(job_id: string): string | undefined {
  const e = store.get(job_id.trim());
  if (!e || e.expires_at <= Date.now()) return undefined;
  return e.chart_thesis_block;
}

export function setMemoizedChartThesisBlock(job_id: string, value: string): void {
  sweep();
  const e = touch(job_id);
  e.chart_thesis_block = value;
}

/** Test / job teardown helper. */
export function clearDeliveryFeedStringMemo(job_id?: string): void {
  if (!job_id) {
    store.clear();
    return;
  }
  store.delete(job_id.trim());
}
