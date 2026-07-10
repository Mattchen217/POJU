import type { LLMCallDebug } from "@/lib/llm/llm-debug";
import {
  expectedEffortForCall,
  formatMs,
  formatRatio,
  formatTokenCount,
  isEffortBelowExpected,
} from "@/lib/llm/llm-debug";

type Props = {
  debug: LLMCallDebug;
  locale: string;
};

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function warnClass(active: boolean): string {
  return active ? " poju-llm-debug__warn" : "";
}

function dangerClass(active: boolean): string {
  return active ? " poju-llm-debug__danger" : "";
}

export function LLMCallDebugPanel({ debug, locale }: Props) {
  const zh = locale.startsWith("zh");
  const label = zh ? "LLM · 调用调试" : "LLM · call debug";

  const requestedEffort = str(debug.requested_effort, "high");
  const phase = str(debug.phase);
  const model = str(debug.model);
  const finishReason = debug.finish_reason ?? "—";
  const promptTokens = num(debug.prompt_tokens);
  const cachedTokens = num(debug.cached_tokens);
  const completionTokens = num(debug.completion_tokens);
  const reasoningTokens = num(debug.reasoning_tokens);
  const reasoningBudget = num(debug.reasoning_budget);
  const cacheRatio = num(debug.cache_ratio);
  const reasoningUsedRatio = num(debug.reasoning_used_ratio);
  const latencyMs = num(debug.latency_ms);
  const attempt = num(debug.attempt, 1);

  const finishTruncated = finishReason === "length";
  const lowReasoning = reasoningBudget > 0 && reasoningUsedRatio < 0.05;
  const expected = expectedEffortForCall(debug.phase, debug.phase);
  const effortMismatch =
    expected != null && isEffortBelowExpected(requestedEffort as LLMCallDebug["requested_effort"], expected);
  const cacheMiss = promptTokens > 8000 && cacheRatio === 0 && cachedTokens === 0;

  const reasoningLine = `${formatTokenCount(reasoningTokens)} / budget ${formatTokenCount(reasoningBudget)} (${formatRatio(reasoningUsedRatio)})`;

  return (
    <div className="poju-llm-debug" aria-label={label}>
      <div className="poju-llm-debug__title">{label}</div>
      <div className="poju-llm-debug__line">
        phase: <code>{phase}</code>
        {" · "}
        effort:{" "}
        <code className={dangerClass(effortMismatch)}>{requestedEffort}</code>
        {" · "}
        model: <code>{model}</code>
      </div>
      <div className="poju-llm-debug__line">
        provider: <code>{str(debug.served_provider)}</code>
        {" · "}
        finish:{" "}
        <code className={dangerClass(finishTruncated)}>{finishReason}</code>
        {" · "}
        attempt: <code>{attempt}</code>
        {debug.retried ? " · retried" : ""}
        {debug.fell_back ? " · fallback" : ""}
      </div>
      <div className={"poju-llm-debug__line" + warnClass(cacheMiss)}>
        prompt: {formatTokenCount(promptTokens)}
        {" · "}
        cached: {formatTokenCount(cachedTokens)} ({formatRatio(cacheRatio)})
        {" · "}
        completion: {formatTokenCount(completionTokens)}
      </div>
      <div className={"poju-llm-debug__line" + warnClass(lowReasoning)}>
        reasoning: <code>{reasoningLine}</code>
      </div>
      <div className="poju-llm-debug__line">
        latency: {formatMs(latencyMs)}
        {debug.generation_time_ms != null ? ` · gen: ${formatMs(num(debug.generation_time_ms))}` : ""}
      </div>
      {(debug.phase_from || debug.phase_to) && (
        <div className="poju-llm-debug__line">
          phase: <code>{str(debug.phase_from)}</code>
          {" → "}
          <code>{str(debug.phase_to)}</code>
          {typeof debug.understanding_sufficient === "boolean"
            ? ` · sufficient: ${debug.understanding_sufficient ? "true" : "false"}`
            : ""}
        </div>
      )}
      {debug.generation_id ? (
        <div className="poju-llm-debug__line poju-llm-debug__gen">
          gen_id: <code>{debug.generation_id}</code>
        </div>
      ) : null}
    </div>
  );
}
