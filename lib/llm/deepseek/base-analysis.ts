/**
 * Step 7 — 命主基础分析（DeepSeek / OpenRouter，一次生成，IndexedDB 永久缓存）
 *
 * 客户端 IndexedDB 无法被服务端读取，因此 LLM 调用走 `POST /api/profile/base-analysis`，
 * 再由 `saveBaseAnalysis` 写回 `stored_profiles`。
 */

import { consumeFetchSse } from "@/lib/llm/consume-sse-client";
import { HOUR_PERIOD_INFO, type UserProfile } from "@/lib/profile/types";
import {
  getStoredProfile,
  getStoredProfileRecord,
  profileHasBaseAnalysis,
  saveBaseAnalysis,
} from "@/lib/profile/stored-profiles-service";
import { userProfileForApiRequest } from "@/lib/profile/user-profile-api";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";

export type BaseAnalysisStreamCallbacks = {
  onReasoning?: (fullReasoning: string) => void;
  onContent?: (fullContent: string) => void;
};

/** Slightly under Vercel `maxDuration` (300s) so the client aborts before the edge kills the socket. */
export const BASE_ANALYSIS_CLIENT_TIMEOUT_MS = 280_000;

const BASE_ANALYSIS_SYSTEM = `# 角色

你是一位拥有 30 年经验的资深中国传统命盘分析专家，精通《渊海子平》《滴天髓》《三命通会》《穷通宝鉴》。
你的任务是根据用户提供的四柱与排盘引擎摘要，生成一份【命主基础分析】。

# 重要说明

这是【命主基础分析】，不针对任何具体问题。后续针对具体困境会有单独分析。
你这次的输出会被【永久缓存】，所以要：输出完整、覆盖核心维度、少空话。

# 输入局限（必须遵守）

用户数据来自本地排盘引擎，可能**只有**四柱干支字符串与简短 diagnosis，**没有**逐条大运 JSON、神煞表、刑冲合害列表。
- 若输入未给出精确起运岁数，请据经典方法合理推演，并在文中标明「推演」或「约」。
- 不要编造与用户四柱矛盾的「精确流年」；可给方向性时间窗。
- 喜忌元素须与输入中的 favorable / challenging 元素方向一致，可展开论述，不可擅自改成相反结论。

# 输出格式（严格 JSON，不要 markdown 代码围栏）

{
  "命主基础": {
    "日主分析": "300-500 字。日主天干及其五行特征，结合月令与地支关系（可推演藏干、刑冲合害趋势）。",
    "格局判断": {
      "主格": "如：正官格、食神格、伤官格、偏财格等（若难定，写「偏格/杂格」并说明）",
      "格局成败": "成格 / 破格 / 半成格",
      "格局解读": "200-400 字。",
      "辅格": "如有则写，无则写「无明显辅格」"
    },
    "用神忌神": {
      "用神": "五行（wood/fire/earth/metal/water 或 木火土金水）",
      "忌神": "五行",
      "喜神": "可选",
      "用神解释": "300-400 字。"
    },
    "强弱定性": "strong | balanced | weak",
    "命局亮点": ["5-8 条，每条 50-80 字"],
    "命局隐忧": ["3-5 条，每条 50-80 字"]
  },
  "性格画像": {
    "天性特征": ["5-8 条，具体行为模式，避免空泛形容词堆砌"],
    "天赋能力": ["3-5 条"],
    "性格盲点": ["3-5 条"]
  },
  "人生主题": {
    "事业方向": "200-400 字",
    "财富特征": "150-300 字",
    "婚恋特征": "150-300 字",
    "健康注意": "150-300 字",
    "贵人方位": "100-200 字"
  },
  "大运全程": {
    "起运说明": "含推演说明",
    "大运按时序解读": [
      { "时段": "示例 5-14 岁", "干支": "示例", "十神": "示例", "主题": "100-200 字" }
    ]
  },
  "当前大运详解": {
    "时段": "",
    "干支": "",
    "十神": "",
    "主题": "300-500 字",
    "三大变化": ["三条"],
    "关键时间窗": ["2-3 个方向性时间窗"]
  },
  "传统调候建议": {
    "推荐方位": [],
    "推荐颜色": [],
    "推荐物件": ["5-8 条具体可操作建议"],
    "推荐居住朝向": "",
    "推荐生活方位": "",
    "需要规避的": ""
  },
  "_meta": {
    "version": "v1.0"
  }
}

# 写作要求

- 全部中文输出
- 内容尽量完整、具体；若篇幅与 JSON 合法性冲突，**优先保证合法 JSON 且不要被截断**
- 单字段可适当精炼，但核心维度必须齐全
- 严格合法 JSON：双引号、逗号、无尾逗号、字符串内换行需 \\n
- 不要输出 markdown，只输出 JSON 对象`;

export function buildBaseAnalysisPrompt(profile: UserProfile): { system: string; user: string } {
  const b = profile.birth;
  const favorable = profile.diagnosis.favorableElements?.length
    ? profile.diagnosis.favorableElements.join("、")
    : "（未标注）";
  const challenging = profile.diagnosis.challengingElements?.length
    ? profile.diagnosis.challengingElements.join("、")
    : "（未标注）";

  const periodLabel = HOUR_PERIOD_INFO[b.hour_period].zh_label;
  const tst = profile.tst_meta ?? b.tst_meta;
  const tstBlock = tst
    ? `
## 真太阳时（排盘已校正）
- 钟表时间：${tst.original_date} ${tst.original_time}
- 真太阳时：${tst.true_solar_date} ${tst.true_solar_time}
- 修正：${tst.diff_minutes} 分钟
- 经度：${tst.longitude}°
- 版本：${tst.computation_version}`
    : "";

  const user = `【八字与排盘摘要】

## 公历出生
- 日期：${b.year} 年 ${b.month} 月 ${b.day} 日
- 时辰：${periodLabel}
- 性别：${b.gender}
- 时区：${b.timezone}${b.birth_location?.name ? `\n- 出生地：${b.birth_location.name}` : ""}${tstBlock}

## 四柱（干支）
- 年柱：${profile.bazi.yearPillar}
- 月柱：${profile.bazi.monthPillar}
- 日柱：${profile.bazi.dayPillar}（日干为日主所在柱）
- 时柱：${profile.bazi.hourPillar}

## 引擎 diagnosis（须与此一致，可深化不可推翻）
- 日主：${profile.diagnosis.dayMaster}
- 喜用 / 有利元素方向：${favorable}
- 忌神 / 不利元素方向：${challenging}
- 格局摘要：${profile.diagnosis.patternSummary}

## 数据来源
- source：${profile.source}

【任务】
请输出上述 JSON 结构的命主基础分析（仅 JSON，中文）。`;

  return { system: stitchPromptSections(BASE_ANALYSIS_SYSTEM), user };
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/g, "")
    .trim();
}

function extractJsonObjectSubstring(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return raw.slice(start, end + 1);
}

export function parseBaseAnalysisResponseText(raw: string): unknown {
  const candidates = [raw, stripJsonFences(raw), extractJsonObjectSubstring(raw) ?? ""].filter(
    (s) => s.length > 0,
  );
  const unique = [...new Set(candidates)];

  let lastError: unknown;
  for (const candidate of unique) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Model output is not valid JSON");
}

function assertBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("generateBaseAnalysis is browser-only (uses IndexedDB + fetch)");
  }
}

/**
 * 读取缓存；若无则调用 `/api/profile/base-analysis` 生成并写入 `stored_profiles`。
 */
function baseAnalysisApiBody(profileId: string, userProfile: UserProfile, displayName: string | null) {
  return {
    user_profile: userProfileForApiRequest(userProfile),
    stored_profile_id: profileId,
    display_name: displayName,
  };
}

function wrapFetchNetworkError(e: unknown): Error {
  if (e instanceof TypeError) {
    const msg = e.message.toLowerCase();
    if (msg.includes("load failed") || msg.includes("failed to fetch") || msg.includes("networkerror")) {
      return new Error("NETWORK_LOAD_FAILED");
    }
  }
  return e instanceof Error ? e : new Error(String(e));
}

async function postBaseAnalysis(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  try {
    return await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("BASE_ANALYSIS_CLIENT_TIMEOUT");
    }
    throw wrapFetchNetworkError(e);
  }
}

async function readCachedBaseAnalysis(profileId: string): Promise<unknown | null> {
  const data = await getStoredProfile(profileId);
  if (data?.base_analysis?.content !== undefined && data.base_analysis.content !== null) {
    return data.base_analysis.content;
  }
  if (await profileHasBaseAnalysis(profileId)) {
    const again = await getStoredProfile(profileId);
    if (again?.base_analysis?.content != null) return again.base_analysis.content;
  }
  return null;
}

async function generateBaseAnalysisViaStream(
  profileId: string,
  userProfile: UserProfile,
  displayName: string | null,
  callbacks?: BaseAnalysisStreamCallbacks,
): Promise<{ analysis: unknown; model: string; tokens_used: number }> {
  const res = await postBaseAnalysis(
    "/api/profile/base-analysis/stream",
    baseAnalysisApiBody(profileId, userProfile, displayName),
    undefined,
  );

  type DonePayload = { analysis?: unknown; model?: string; tokens_used?: number };
  let donePayload: DonePayload | null = null;
  let errMsg: string | null = null;

  await consumeFetchSse(res, (ev) => {
    const type = ev.type;
    if (type === "reasoning" && typeof ev.text === "string") {
      callbacks?.onReasoning?.(ev.text);
    }
    if (type === "content" && typeof ev.text === "string") {
      callbacks?.onContent?.(ev.text);
    }
    if (type === "error" && typeof ev.message === "string") {
      errMsg = ev.message;
    }
    if (type === "done" && ev.ok) {
      donePayload = {
        analysis: ev.analysis,
        model: typeof ev.model === "string" ? ev.model : "unknown",
        tokens_used: typeof ev.tokens_used === "number" ? ev.tokens_used : 0,
      };
    }
  });

  if (errMsg) throw new Error(errMsg);
  if (!res.ok) throw new Error(`Base analysis stream failed (${res.status})`);
  const finished = donePayload as DonePayload | null;
  if (!finished || finished.analysis === undefined) {
    throw new Error("Base analysis stream ended without result");
  }

  return {
    analysis: finished.analysis,
    model: finished.model ?? "unknown",
    tokens_used: finished.tokens_used ?? 0,
  };
}

async function generateBaseAnalysisViaJson(
  profileId: string,
  userProfile: UserProfile,
  displayName: string | null,
): Promise<{
  analysis: unknown;
  raw_text?: string;
  model: string;
  tokens_used: number;
}> {
  const llmStart = Date.now();
  console.log("[base-analysis] LLM call start (client → /api/profile/base-analysis)");

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), BASE_ANALYSIS_CLIENT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await postBaseAnalysis(
      "/api/profile/base-analysis",
      baseAnalysisApiBody(profileId, userProfile, displayName),
      controller.signal,
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  const payload = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    analysis?: unknown;
    raw_text?: string;
    model?: string;
    tokens_used?: number;
    error?: string;
  };

  if (!res.ok || !payload.ok || payload.analysis === undefined) {
    throw new Error(payload.error || `Base analysis request failed (${res.status})`);
  }

  console.log("[base-analysis] LLM call end (client)", {
    duration_ms: Date.now() - llmStart,
    tokens: payload.tokens_used,
    model: payload.model,
  });

  return {
    analysis: payload.analysis,
    raw_text: typeof payload.raw_text === "string" ? payload.raw_text : undefined,
    model: typeof payload.model === "string" ? payload.model : "unknown",
    tokens_used: typeof payload.tokens_used === "number" ? payload.tokens_used : 0,
  };
}

export async function generateBaseAnalysis(
  profileId: string,
  callbacks?: BaseAnalysisStreamCallbacks,
): Promise<unknown> {
  assertBrowser();
  const data = await getStoredProfile(profileId);
  if (!data) throw new Error("Profile not found");
  if (data.base_analysis?.content !== undefined && data.base_analysis.content !== null) {
    return data.base_analysis.content;
  }

  const record = await getStoredProfileRecord(profileId);
  const displayName = record?.display_name ?? null;

  const wantsStream = Boolean(callbacks?.onReasoning || callbacks?.onContent);

  let result: { analysis: unknown; raw_text?: string; model: string; tokens_used: number };
  if (wantsStream) {
    try {
      result = await generateBaseAnalysisViaStream(profileId, data.user_profile, displayName, callbacks);
    } catch (streamErr) {
      console.warn("[base-analysis] Stream failed, falling back to JSON:", streamErr);
      result = await generateBaseAnalysisViaJson(profileId, data.user_profile, displayName);
    }
  } else {
    // Preparing / Syncro / Glyph：无流式 UI；JSON 单次请求在 iOS Safari 上更稳（SSE 长连接易报 Load failed）
    try {
      result = await generateBaseAnalysisViaJson(profileId, data.user_profile, displayName);
    } catch (jsonErr) {
      const cached = await readCachedBaseAnalysis(profileId);
      if (cached != null) {
        return cached;
      }
      const msg = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
      if (msg === "BASE_ANALYSIS_CLIENT_TIMEOUT" || msg === "NETWORK_LOAD_FAILED") {
        throw jsonErr instanceof Error ? jsonErr : new Error(msg);
      }
      console.warn("[base-analysis] JSON failed, trying stream:", jsonErr);
      try {
        result = await generateBaseAnalysisViaStream(profileId, data.user_profile, displayName);
      } catch (streamErr) {
        const cachedAfter = await readCachedBaseAnalysis(profileId);
        if (cachedAfter != null) return cachedAfter;
        throw streamErr;
      }
    }
  }

  await saveBaseAnalysis(profileId, result.analysis, {
    model: result.model,
    tokens_used: result.tokens_used,
    raw_text: result.raw_text,
    used_true_solar_time: data.user_profile.used_true_solar_time,
    tst_meta: data.user_profile.tst_meta ?? data.user_profile.birth.tst_meta,
  });

  const { clearPendingBaseAnalysisProfile } = await import("@/lib/profile/pending-base-analysis");
  clearPendingBaseAnalysisProfile();

  return result.analysis;
}

export async function getBaseAnalysisOrGenerate(profileId: string): Promise<unknown> {
  assertBrowser();
  const data = await getStoredProfile(profileId);
  if (!data) throw new Error("Profile not found");
  if (data.base_analysis?.content !== undefined && data.base_analysis.content !== null) {
    return data.base_analysis.content;
  }
  return generateBaseAnalysis(profileId);
}
