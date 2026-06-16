import type { POJUAction } from "@/lib/poju/types";
import type { POJUActionRecommendationsData } from "@/lib/archive/archive-service";

export type ArchiveActionCategory =
  POJUActionRecommendationsData["actions"][number]["category"];

function mapCategory(category: POJUAction["category"]): ArchiveActionCategory {
  if (category === "traditional") return "traditional_fengshui";
  return category;
}

function shortTitle(text: string, max = 30): string {
  const line = text.split("\n")[0]?.trim() || text.trim();
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1)}…`;
}

/** Map session delivery actions into encrypted archive payload rows. */
export function mapSessionActionsToArchiveActions(actions: POJUAction[]) {
  return actions.map((a) => ({
    action_id: a.action_id,
    category: mapCategory(a.category),
    title: a.title?.trim() || shortTitle(a.text),
    description: a.text,
    rationale: a.rationale,
    timing: a.timing,
    status: a.status,
    user_feedback: a.user_feedback,
    updated_at: a.updated_at,
  }));
}
