import { sessionListTopicLine } from "@/lib/poju/session-list-label";

/** Old unlock descriptions stored before session short titles. */
const LEGACY_USAGE_DESC =
  /full\s+delivery|full\s+unlock|pivot\s+full\s+delivery/i;

/** Short topic line stored on pass_usage.description for decision dialogues. */
export function passUsageTopicFromQuestion(
  question: string | null | undefined,
  fallback = "Session",
): string {
  return sessionListTopicLine(question ?? "", fallback);
}

export function isLegacyPassUsageDescription(desc: string | null | undefined): boolean {
  const d = desc?.trim() ?? "";
  if (!d) return true;
  return LEGACY_USAGE_DESC.test(d);
}
