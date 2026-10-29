import { createHash } from "node:crypto";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";

export function hashStableJson(value: unknown): string {
  const json = JSON.stringify(value ?? null);
  return createHash("sha256").update(json).digest("hex").slice(0, 24);
}

export function hashChartFactPackText(text: string | null | undefined): string {
  return hashStableJson((text ?? "").trim());
}

export function hashZiweiFactPack(
  pack: ZiweiFactPack | null | undefined,
): string | null {
  if (!pack) return null;
  return hashStableJson({
    topicPalace: pack.topicPalace,
    sihua: pack.sihua,
    daxian: pack.daxian,
    mingShen: pack.mingShen,
    patternHits: pack.patternHits?.map((h) => h.name) ?? [],
    source: pack.source?.library,
  });
}
