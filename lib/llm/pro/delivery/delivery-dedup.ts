/**
 * Soft cross-page dedup for Phase-4 delivery books.
 * Detects repeated nurture-axis metaphors / openings; logs + light demotion only.
 */

const NURTURE_AXIS_RE =
  /小森林|养好?(?:自己的)?根|把自己活成|宜守不宜攻|先养(?:根|自己)|向内积累|冬天(?:的)?(?:根系|季节)|缘分.*内心|内心.*缘分|live yourself into a (?:small )?forest|nurture (?:your )?roots|tend (?:your )?roots|inward accumulation/gi;

const SAME_OPENING_STEMS = [
  /先把自己/g,
  /现阶段最重要的不是/g,
  /真正的时机/g,
  /把重心放在/g,
  /the most important thing (?:right )?now/gi,
  /the real timing/gi,
];

export type DeliveryDedupFinding = {
  kind: "nurture_axis" | "same_opening";
  count: number;
  sample: string;
};

/** Count nurture-axis hits across page bodies (skip evidence / fences). */
export function detectDeliveryDedupIssues(markdown: string): DeliveryDedupFinding[] {
  const bodies = extractProseBodies(markdown);
  const joined = bodies.join("\n\n");
  const findings: DeliveryDedupFinding[] = [];

  const nurtureHits = [...joined.matchAll(NURTURE_AXIS_RE)];
  if (nurtureHits.length >= 3) {
    findings.push({
      kind: "nurture_axis",
      count: nurtureHits.length,
      sample: nurtureHits[0]?.[0] ?? "",
    });
  }

  for (const re of SAME_OPENING_STEMS) {
    re.lastIndex = 0;
    const hits = [...joined.matchAll(re)];
    if (hits.length >= 3) {
      findings.push({
        kind: "same_opening",
        count: hits.length,
        sample: hits[0]?.[0] ?? "",
      });
    }
  }

  return findings;
}

function extractProseBodies(markdown: string): string[] {
  const withoutStructs = markdown.replace(/```poju-struct[\s\S]*?```/g, "");
  const withoutEvidence = withoutStructs.replace(
    /\*\*(?:依据|Evidence|依据与推理)[:：]?\*\*[\s\S]*?(?=(?:###|\*\*(?:依据|Evidence)|$))/gi,
    "\n",
  );
  return withoutEvidence
    .split(/^##\s+/m)
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Soft demotion: after the first nurture-axis hit, shorten later redundant
 * sentences that are pure nurture repeats (keep page-specific content).
 * Conservative — only trims short standalone paragraphs that match the axis.
 */
export function softDemoteNurtureRepetition(markdown: string): string {
  const findings = detectDeliveryDedupIssues(markdown);
  if (!findings.some((f) => f.kind === "nurture_axis" && f.count >= 3)) {
    return markdown;
  }

  let seen = 0;
  return markdown.replace(/(^|\n\n)([^\n#`][^\n]{12,160})(?=\n\n|$)/g, (full, lead, para: string) => {
    NURTURE_AXIS_RE.lastIndex = 0;
    if (!NURTURE_AXIS_RE.test(para)) return full;
    // Only demote if the paragraph is mostly the nurture line (short + matched).
    const density = (para.match(NURTURE_AXIS_RE) ?? []).join("").length / Math.max(para.length, 1);
    NURTURE_AXIS_RE.lastIndex = 0;
    if (density < 0.08 && para.length > 80) return full;
    seen += 1;
    if (seen <= 1) return full;
    return `${lead}`;
  });
}

export function logDeliveryDedupFindings(findings: DeliveryDedupFinding[]): void {
  if (findings.length === 0) return;
  console.warn(
    "[delivery-dedup]",
    findings.map((f) => `${f.kind}×${f.count}(${f.sample})`).join("; "),
  );
}
