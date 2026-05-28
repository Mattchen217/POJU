import type { ToolName } from "@/lib/poju/types";

export function buildSuggestedQuestionFromTool(
  tool: ToolName,
  data: Record<string, unknown>,
): string {
  switch (tool) {
    case "match": {
      const rel =
        typeof data.relationship_description === "string"
          ? data.relationship_description
          : typeof data.summary === "string"
            ? data.summary.slice(0, 80)
            : "this relationship";
      return `I want to go deeper on this relationship: ${rel}. What should I focus on, and what can I actually do?`;
    }
    case "syncro": {
      const task =
        typeof data.task_description === "string"
          ? data.task_description
          : "this decision";
      return `I used Syncro on: ${task}. Help me decide whether to act, how, and what POJU should watch for as I move forward.`;
    }
    case "glyph": {
      const q = typeof data.question === "string" ? data.question : "what this reading reflected";
      return `I drew Glyph on: "${q}". Help me understand what it means for me and what to do with it.`;
    }
    default:
      return "I'd like to continue this analysis with POJU.";
  }
}
