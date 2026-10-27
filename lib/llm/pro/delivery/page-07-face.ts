/**
 * Page 07 write path.
 * No DAG task. When the topic gate is open, compose the page from
 * sliceForPage("07") + schema duties A–C + the user's question.
 * Segment D adds no fields. otherChart is included only when the slice already has it.
 */

import { DECISION_PAGE_SCHEMAS } from "@/lib/llm/pro/delivery/page-schema/decision-pages";
import {
  deliveryTopicFromSignals,
  page07Applies,
  sliceForPage,
  type PageFeedPacks,
  type PageSlice,
} from "@/lib/llm/pro/delivery/slice-for-page";

/** Slice compose. There is still no DAG key for 07. */
export const PAGE07_WRITE_ENTRY = "slice:07" as const;

export type Page07ComposeInput = {
  topic?: string | null;
  question?: string | null;
  packs?: PageFeedPacks | null;
};

function clip(value: string): string {
  const text = value.trim();
  if (text.length <= 240) return text;
  return `${text.slice(0, 240)}…`;
}

function formatSliceValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return clip(value) || null;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((item) => formatSliceValue(item)).filter((item): item is string => Boolean(item));
    return parts.length ? clip(parts.join("；")) : null;
  }
  if (typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.palace === "string" && Array.isArray(row.majorStars)) {
    const stars = row.majorStars.filter((star) => typeof star === "string").join("、");
    const opposite =
      typeof row.oppositePalace === "string" && row.oppositePalace
        ? `，对宫${row.oppositePalace}`
        : "";
    const oppositeStars = Array.isArray(row.oppositeMajorStars)
      ? row.oppositeMajorStars.filter((star) => typeof star === "string").join("、")
      : "";
    return clip(`${row.palace}${stars ? `·${stars}` : ""}${opposite}${oppositeStars ? `（${oppositeStars}）` : ""}`);
  }
  if (typeof row.mutagen === "string" && typeof row.star === "string") {
    const palace = typeof row.palace === "string" && row.palace ? `·${row.palace}` : "";
    return `${row.mutagen}${row.star}${palace}`;
  }
  if (typeof row.palace === "string" && (typeof row.startAge === "number" || typeof row.endAge === "number")) {
    const stars = Array.isArray(row.majorStars)
      ? row.majorStars.filter((star) => typeof star === "string").join("、")
      : "";
    const range =
      typeof row.startAge === "number" && typeof row.endAge === "number"
        ? ` ${row.startAge}–${row.endAge}`
        : "";
    return clip(`${row.palace}${range}${stars ? `·${stars}` : ""}`);
  }
  const bits = Object.entries(row)
    .filter(([key, item]) => key !== "palaces" && key !== "source" && key !== "text" && item != null && typeof item !== "object")
    .map(([key, item]) => `${key}=${String(item)}`);
  return bits.length ? clip(bits.join("，")) : null;
}

function sliceValue(slice: PageSlice, code: string): unknown {
  const [group, key] = code.split(".");
  if (!key) return undefined;
  if (group === "CFP") return slice.cfp?.[key as "pathTags"];
  if (group === "ZFP") return slice.zfp?.[key as "topicPalace"];
  if (group === "User") return slice.user?.[key as "detail"];
  if (group === "Sci" && key === "hooks") return slice.sci?.hooks;
  return undefined;
}

export function composePage07Markdown(input: Page07ComposeInput): string | null {
  const topic = deliveryTopicFromSignals({
    topic: input.topic,
    question: input.question,
  });
  if (!topic || !page07Applies(topic)) return null;
  const question = input.question?.trim() ?? "";
  const packs: PageFeedPacks = {
    ...input.packs,
    topic,
    user: {
      ...input.packs?.user,
      detail: input.packs?.user?.detail ?? (question || undefined),
    },
  };
  const sliced = sliceForPage("07", packs);
  const schema = DECISION_PAGE_SCHEMAS["07"];
  const lines = [`## ${schema.title}`, "", `本题落在：${topic}`];
  if (question) lines.push("", question);

  for (const segment of schema.segments) {
    if (segment.id === "D") continue;
    const allow = sliced.segments.find((item) => item.id === segment.id);
    const facts: string[] = [];
    for (const code of allow?.fields ?? []) {
      const value = sliceValue(sliced.slice, code);
      if (code === "User.detail" && question && value === question) continue;
      const line = formatSliceValue(value);
      if (line && !facts.includes(line)) facts.push(line);
    }
    lines.push("", `### ${segment.label}`, segment.duty);
    if (facts.length) lines.push("", facts.join("\n"));
  }
  return lines.join("\n");
}
