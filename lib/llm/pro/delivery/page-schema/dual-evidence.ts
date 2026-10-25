/**
 * v1 dual-track evidence · split / compose / gate helpers.
 * Prefer structured metaphysics_evidence + science_evidence;
 * migrate legacy 「【命理】…【科学】…」 single string.
 */

export type DualEvidenceParts = {
  metaphysics_evidence: string;
  science_evidence: string;
  /** Combined for mark / legacy consumers. */
  evidence: string;
};

const META_MARK = /【命理】/;
const SCI_MARK = /【科学】/;

/** Split legacy combined evidence into dual parts. */
export function splitDualEvidence(raw: string | null | undefined): DualEvidenceParts {
  const s = (raw ?? "").trim();
  if (!s) {
    return { metaphysics_evidence: "", science_evidence: "", evidence: "" };
  }
  const hasMeta = META_MARK.test(s);
  const hasSci = SCI_MARK.test(s);
  if (hasMeta || hasSci) {
    const metaIdx = s.search(META_MARK);
    const sciIdx = s.search(SCI_MARK);
    let metaphysics = "";
    let science = "";
    if (metaIdx >= 0 && sciIdx >= 0) {
      if (metaIdx < sciIdx) {
        metaphysics = s.slice(metaIdx).replace(META_MARK, "").split(SCI_MARK)[0]?.trim() ?? "";
        science = s.slice(sciIdx).replace(SCI_MARK, "").trim();
      } else {
        science = s.slice(sciIdx).replace(SCI_MARK, "").split(META_MARK)[0]?.trim() ?? "";
        metaphysics = s.slice(metaIdx).replace(META_MARK, "").trim();
      }
    } else if (metaIdx >= 0) {
      metaphysics = s.slice(metaIdx).replace(META_MARK, "").trim();
    } else if (sciIdx >= 0) {
      science = s.slice(sciIdx).replace(SCI_MARK, "").trim();
    }
    return composeDualEvidence(metaphysics, science);
  }
  // No markers: treat whole as metaphysics (legacy pure chart evidence).
  return composeDualEvidence(s, "");
}

export function composeDualEvidence(
  metaphysics: string,
  science: string,
): DualEvidenceParts {
  const m = metaphysics.trim();
  const sci = science.trim();
  const parts: string[] = [];
  if (m) parts.push(m);
  if (sci) parts.push(sci);
  return {
    metaphysics_evidence: m,
    science_evidence: sci,
    evidence: parts.join("\n"),
  };
}

/** Normalize a unit-like object to always have dual fields + combined evidence. */
export function normalizeUnitDualEvidence<
  T extends {
    evidence?: string;
    metaphysics_evidence?: string;
    science_evidence?: string;
  },
>(unit: T): T & DualEvidenceParts {
  const m = (unit.metaphysics_evidence ?? "").trim();
  const sci = (unit.science_evidence ?? "").trim();
  if (m || sci) {
    const dual = composeDualEvidence(m, sci);
    return { ...unit, ...dual };
  }
  const dual = splitDualEvidence(unit.evidence);
  return { ...unit, ...dual };
}

/** Soft case-binding heuristic for science track (must mention case-ish tokens). */
const CASE_BIND_RE =
  /你|本案|对方|关系|工作|收入|期限|收集|事实|选项|路径|协议|实验|验证|推进|停止|切换|窗口|决策|风险|成本|收益/;

export type DualEvidenceGateResult =
  | { ok: true }
  | { ok: false; reason: string };

export function gateDualEvidenceParts(
  parts: DualEvidenceParts,
  opts?: { requireScience?: boolean },
): DualEvidenceGateResult {
  const requireScience = opts?.requireScience !== false;
  if (!parts.metaphysics_evidence || parts.metaphysics_evidence.length < 24) {
    return { ok: false, reason: "dual_missing_metaphysics" };
  }
  if (requireScience) {
    if (!parts.science_evidence || parts.science_evidence.length < 12) {
      return { ok: false, reason: "dual_missing_science" };
    }
    if (!CASE_BIND_RE.test(parts.science_evidence)) {
      return { ok: false, reason: "dual_science_unbound" };
    }
  }
  // Metaphysics that would still apply to anyone after stripping chart terms → weak
  const stripped = parts.metaphysics_evidence
    .replace(/⟦w:[^⟧]*⟧/g, "")
    .replace(/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥木火土金水]/g, "")
    .trim();
  if (stripped.length > 40 && !/用|忌|生|克|冲|合|运|局|宫|门|星|印|财|官|食|伤|比|劫/.test(parts.metaphysics_evidence)) {
    // keep soft — hard fail only when almost no structure words left AND no slots
    if (!/⟦w:/.test(parts.metaphysics_evidence) && stripped === parts.metaphysics_evidence.replace(/\s+/g, "")) {
      return { ok: false, reason: "dual_metaphysics_generic" };
    }
  }
  return { ok: true };
}
