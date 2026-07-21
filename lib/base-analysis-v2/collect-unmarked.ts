import { kv } from "@/lib/kv/client";

export const UNMARKED_CANDIDATES_KEY = "mingli:unmarked-candidates";

/** 宽松疑似命理词（可误杀；人工复核）。 */
const SUSPECT_PATTERNS: readonly RegExp[] = [
  /[\u4e00-\u9fa5]{1,3}(煞|刃|星|宫|格|禄|贵人|驿马|桃花|华盖)/g,
  /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g,
  /(相冲|相刑|相害|相破|六合|三合|半合|自刑)/g,
];

/**
 * 从最终输出里，把【没打标(不在⟦t:⟧内)】的疑似命理词收集进候选池。
 * locale 预留：日后可按站过滤；当前中英共享同一候选池。
 */
export async function collectUnmarkedMingliCandidates(
  text: string,
  _locale: string,
): Promise<void> {
  if (!text?.trim()) return;

  const outsideMarkers = text
    .replace(/⟦t:[^⟧]*⟧/g, " ")
    .replace(/【[^】]*】/g, " ");

  const found = new Set<string>();
  for (const re of SUSPECT_PATTERNS) {
    re.lastIndex = 0;
    for (const m of outsideMarkers.matchAll(re)) {
      if (m[0]?.trim()) found.add(m[0]);
    }
  }
  if (found.size === 0) return;

  const existing =
    ((await kv.get(UNMARKED_CANDIDATES_KEY)) as Record<string, number> | null) ?? {};
  for (const w of found) {
    existing[w] = (existing[w] ?? 0) + 1;
  }
  await kv.set(UNMARKED_CANDIDATES_KEY, existing);
}

export async function readUnmarkedCandidates(): Promise<Record<string, number>> {
  return ((await kv.get(UNMARKED_CANDIDATES_KEY)) as Record<string, number> | null) ?? {};
}

export async function removeUnmarkedCandidate(word: string): Promise<Record<string, number>> {
  const existing = await readUnmarkedCandidates();
  delete existing[word];
  await kv.set(UNMARKED_CANDIDATES_KEY, existing);
  return existing;
}

export async function clearUnmarkedCandidates(): Promise<void> {
  await kv.set(UNMARKED_CANDIDATES_KEY, {});
}
