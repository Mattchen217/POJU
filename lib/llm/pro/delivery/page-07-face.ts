/**
 * Page 07 read-path face.
 * No DAG task and no new model call. The write entry is the existing 07 schema:
 * duties already locked on the page, plus the user's own question when one was passed.
 * Omitted entirely unless the topic gate is open. otherChart is not composed here.
 */

import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import { page07Applies } from "@/lib/llm/pro/delivery/slice-for-page";

/** 07 does not reuse a v1 segment key. This marks the schema as the write entry. */
export const PAGE07_WRITE_ENTRY = "schema:07" as const;

export function composePage07Markdown(input: {
  topic?: string | null;
  question?: string | null;
}): string | null {
  const topic = input.topic?.trim() ?? "";
  if (!page07Applies(topic)) return null;
  const schema = DECISION_PAGE_SCHEMAS["07"];
  const lines = [`## ${schema.title}`, "", `本题落在：${topic}`];
  for (const segment of schema.segments) {
    if (segment.id === "D") continue;
    lines.push("", `### ${segment.label}`, segment.duty);
  }
  const question = input.question?.trim();
  if (question) {
    lines.push("", question);
  }
  return lines.join("\n");
}
