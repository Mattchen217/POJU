import type { ToolName } from "@/lib/poju/types";

export function renderToolPreviewText(tool: ToolName, data: Record<string, unknown>): string {
  switch (tool) {
    case "match": {
      const level = data.compatibility_level ?? "—";
      const summary = typeof data.summary === "string" ? data.summary : "";
      return summary ? `${String(level)} · ${summary.slice(0, 120)}` : String(level);
    }
    case "syncro": {
      const task = typeof data.task_description === "string" ? data.task_description : "";
      return task.slice(0, 140) || "Syncro timing matrix";
    }
    case "glyph": {
      const q = typeof data.question === "string" ? data.question : "";
      const level = data.glyph_level ?? data.sign_number ?? "";
      return q ? `Sign ${String(level)} · ${q.slice(0, 100)}` : `Sign ${String(level)}`;
    }
    default:
      return "";
  }
}
