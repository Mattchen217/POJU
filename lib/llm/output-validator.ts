import { z } from "zod";

const ActionSchema = z.object({
  text: z.string().min(20),
  category: z.enum(["traditional", "modern_decisive", "modern_reflective"]),
  timing: z.enum(["immediate", "this_week", "this_month", "ongoing"]),
  rationale: z.string().min(10),
});

const MainDeliverySchema = z.object({
  analysis: z.object({
    user_situation_summary: z.string(),
    pattern_insight: z.string(),
    current_phase_insight: z.string(),
    hidden_dynamics: z.array(z.string()),
  }),
  conclusion: z.object({
    core_message: z.string(),
    perspective_shift: z.string(),
  }),
  invitation: z.string(),
});

const ThoughtSchema = z.object({
  current_context_score: z.number().min(0).max(10),
  missing_keys: z.array(z.string()),
  next_best_action: z.enum(["continue_chat", "show_birth_form", "deliver_main", "track_progress"]),
});

export const POJULLMResponseSchema = z.object({
  thought: ThoughtSchema,
  response: z.string().min(10),
  user_intent: z.enum([
    "greeting",
    "sharing_situation",
    "asking_specific",
    "reporting_progress",
    "wrapping_up",
    "unclear",
    "off_topic",
  ]),
  current_state: z.enum([
    "opening",
    "greeting",
    "collecting_context",
    "awaiting_profile",
    "analyzing",
    "delivered",
    "tracking",
  ]),
  action_requested: z.enum(["continue_chat", "show_birth_form", "deliver_main", "track_progress"]).optional(),
  topic_drift_detected: z.boolean(),
  context_updates: z.record(z.string(), z.any()).default({}),
  contains_delivery: z.boolean().default(false),
  main_delivery: MainDeliverySchema.nullable().optional(),
  new_actions: z.array(ActionSchema).optional(),
});

export function validateLLMOutput(raw: any): { valid: boolean; data?: any; error?: string } {
  try {
    const data = POJULLMResponseSchema.parse(raw);

    if (data.contains_delivery) {
      if (!data.main_delivery) {
        return { valid: false, error: "contains_delivery true but main_delivery missing" };
      }
      if (!data.new_actions || data.new_actions.length < 1) {
        return { valid: false, error: "contains_delivery true but new_actions empty" };
      }

      const categories = new Set(data.new_actions.map((a) => a.category));
      if (categories.size < 2 && data.new_actions.length >= 2) {
        console.warn("[validator] Actions lack diversity");
      }
    }

    return { valid: true, data };
  } catch (error: any) {
    return { valid: false, error: error?.message ?? "unknown_validation_error" };
  }
}

export function repairLLMOutput(raw: any, fallbackLocale: string): any {
  const thought =
    raw?.thought &&
    typeof raw.thought === "object" &&
    typeof raw.thought.current_context_score === "number" &&
    Array.isArray(raw.thought.missing_keys) &&
    typeof raw.thought.next_best_action === "string"
      ? raw.thought
      : {
          current_context_score: 2,
          missing_keys: ["situation_detail", "people_or_stakes", "what_you_tried", "what_you_fear_next"],
          next_best_action: "continue_chat" as const,
        };

  return {
    thought,
    response: String(raw?.response ?? raw?.reply ?? "").trim(),
    user_intent: raw?.user_intent || "unclear",
    current_state: raw?.current_state || "collecting_context",
    action_requested: raw?.action_requested || "continue_chat",
    topic_drift_detected: raw?.topic_drift_detected || false,
    context_updates: raw?.context_updates || {},
    contains_delivery: false,
    main_delivery: null,
    new_actions: [],
  };
}

