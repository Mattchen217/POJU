/**
 * Lab-only wiring: soft-stage pack → decision-report reader prose.
 * Reuses mergeReaderEvidenceProse (report UI SoT). Not a 5th pipeline stage.
 */
import { mergeReaderEvidenceProse } from "@/lib/llm/pro/delivery/page-schema/reader-evidence-prose";

/** Collect evidence strings in tree order (Face02 A/B/C(+D) soft args). */
export function evidenceStringsFromStageTree(tree: unknown): string[] {
  const out: string[] = [];
  if (!tree || typeof tree !== "object") return out;
  for (const args of Object.values(tree as Record<string, unknown>)) {
    if (!Array.isArray(args)) continue;
    for (const a of args) {
      if (!a || typeof a !== "object") continue;
      const ev = (a as { evidence?: unknown }).evidence;
      if (typeof ev === "string" && ev.trim()) out.push(ev.trim());
    }
  }
  return out;
}

/**
 * Report UI exit from evidence_soft soft stage (NOT a 5th pipeline stage).
 * Same merge as Face02ReaderEvidenceFold / DualEvidenceBody presentation="prose".
 */
export function mergeLabSoftStageReaderProse(
  softStage: unknown,
  locale: string,
): string {
  const list = evidenceStringsFromStageTree(softStage);
  if (!list.length) return "";
  const metaphysics = list[0] ?? "";
  const science = list[1] ?? "";
  const convergence = list[2] ?? "";
  const extraD = list.slice(3).filter(Boolean).join("\n");
  const primary = mergeReaderEvidenceProse({
    metaphysics,
    science,
    convergence,
    locale,
  });
  if (!extraD) return primary;
  // D (verifiable_anchors) is a separate report fold; append stripped prose so Lab
  // can judge it next to A/B/C without inventing a second merge.
  const dProse = mergeReaderEvidenceProse({ text: extraD, locale });
  if (!dProse) return primary;
  if (!primary) return dProse;
  return `${primary}\n\n${dProse}`;
}
