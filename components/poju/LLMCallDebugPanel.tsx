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

function warnClass(active: boolean): string {
  return active ? " poju-llm-debug__warn" : "";
}

function dangerClass(active: boolean): string {
  return active ? " poju-llm-debug__danger" : "";
}

export function LLMCallDebugPanel({ debug, locale }: Props) {
  const zh = locale.startsWith("zh");
  const label = zh ? "LLM · 调用调试" : "LLM · call debug";

  const finishTruncated = debug.finish_reason === "length";
  const lowReasoning = debug.reasoning_budget > 0 && debug.reasoning_used_ratio < 0.05;
  const expected = expectedEffortForCall(debug.phase, debug.phase);
  const effortMismatch =
    expected != null && isEffortBelowExpected(debug.requested_effort, expected);
  const cacheMiss =
    debug.prompt_tokens > 8000 && debug.cache_ratio === 0 && debug.cached_tokens === 0;

  const reasoningLine = `${formatTokenCount(debug.reasoning_tokens)} / budget ${formatTokenCount(debug.reasoning_budget)} (${formatRatio(debug.reasoning_used_ratio)})`;

  return (
    <div className="poju-llm-debug" aria-label={label}>
      <div className="poju-llm-debug__title">{label}</div>
      <div className="poju-llm-debug__line">
        phase: <code>{debug.phase ?? "—"}</code>
        {" · "}
        effort:{" "}
        <code className={dangerClass(effortMismatch)}>{debug.requested_effort}</code>
        {" · "}
        model: <code>{debug.model}</code>
      </div>
      <div className="poju-llm-debug__line">
        provider: <code>{debug.served_provider ?? "—"}</code>
        {" · "}
        finish:{" "}
        <code className={dangerClass(finishTruncated)}>{debug.finish_reason ?? "—"}</code>
        {" · "}
        attempt: <code>{debug.attempt}</code>
        {debug.retried ? " · retried" : ""}
        {debug.fell_back ? " · fallback" : ""}
      </div>
      <div className={"poju-llm-debug__line" + warnClass(cacheMiss)}>
        prompt: {formatTokenCount(debug.prompt_tokens)}
        {" · "}
        cached: {formatTokenCount(debug.cached_tokens)} ({formatRatio(debug.cache_ratio)})
        {" · "}
        completion: {formatTokenCount(debug.completion_tokens)}
      </div>
      <div className={"poju-llm-debug__line" + warnClass(lowReasoning)}>
        reasoning: <code>{reasoningLine}</code>
      </div>
      <div className="poju-llm-debug__line">
        latency: {formatMs(debug.latency_ms)}
        {debug.generation_time_ms != null ? ` · gen: ${formatMs(debug.generation_time_ms)}` : ""}
      </div>
      {(debug.phase_from || debug.phase_to) && (
        <div className="poju-llm-debug__line">
          phase: <code>{debug.phase_from ?? "—"}</code>
          {" → "}
          <code>{debug.phase_to ?? "—"}</code>
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
