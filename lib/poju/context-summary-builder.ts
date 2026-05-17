import type { ContextSummary, POJUAgentState } from "@/lib/poju/agent-state";

function item(id: string, label: string, value: string, field_key: string) {
  return { item_id: id, label, value, field_key };
}

/** Deterministic fallback when confirmation-phase LLM omits `current_summary`. */
export function buildFallbackContextSummary(agent: POJUAgentState): ContextSummary {
  const cc = agent.context_collected;
  const cat = agent.question_category ?? "other";
  const items: ContextSummary["sections"][0]["items"] = [];

  if (cc.duration) items.push(item("duration", "Duration", cc.duration, "duration"));
  if (cc.trigger_event) items.push(item("trigger", "Trigger", cc.trigger_event, "trigger_event"));
  if (cc.emotional_state) items.push(item("emotion", "Emotional state", cc.emotional_state, "emotional_state"));
  if (cc.desired_outcome) items.push(item("outcome", "Desired outcome", cc.desired_outcome, "desired_outcome"));
  if (cc.what_tried?.length) {
    items.push(item("tried", "Already tried", cc.what_tried.join("; "), "what_tried"));
  }
  for (const [k, v] of Object.entries(cc.category_specific ?? {})) {
    if (v == null || v === "") continue;
    items.push(item(`cat_${k}`, k, String(v), k));
  }
  if (items.length === 0) {
    items.push(item("question", "Original question", agent.original_question, "original_question"));
  }

  return {
    generated_at: new Date().toISOString(),
    category: cat,
    sections: [
      {
        section_id: "collected",
        title: "What we have so far",
        items,
      },
    ],
  };
}
