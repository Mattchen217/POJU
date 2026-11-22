/**
 * Build glossary appendix from term ids that actually appeared in evidence.
 * No model call. Omit appendix when no terms were used.
 */

import { resolveTermForLocale, scanGlossaryAppendixCompliance } from "./body-compliance";
import { Face03GlossarySchema, type Face03Glossary } from "./schemas";

const READING_NOTE: Record<string, string> = {
  zh: "这些词是为了帮助不同语言的读者理解传统分析概念而设计的软译标签；具体含义以本报告依据层中的上下文解释为准。不要把软译术语包装成现代科学概念。",
  en: "These soft labels help readers understand traditional analysis concepts across languages. Meanings follow the evidence-layer context in this report. Do not treat soft labels as modern scientific terms.",
  es: "Estas etiquetas suaves ayudan a entender conceptos de análisis tradicional. El significado sigue el contexto de la capa de evidencia. No las trate como términos científicos modernos.",
  fr: "Ces libellés souples aident à comprendre des concepts d'analyse traditionnelle. Le sens suit le contexte de la couche de preuves. Ne les traitez pas comme des termes scientifiques modernes.",
  de: "Diese Soft-Labels helfen, traditionelle Analysekonzepte zu verstehen. Die Bedeutung folgt dem Kontext der Belegebene. Behandeln Sie sie nicht als moderne Wissenschaftsbegriffe.",
};

export function collectUsedTermIdsFromEvidence(
  evidenceTermIdLists: readonly (readonly string[])[],
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const list of evidenceTermIdLists) {
    for (const id of list) {
      const t = id.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      ordered.push(t);
    }
  }
  return ordered;
}

export function buildGlossaryAppendix(input: {
  locale: string;
  usedTermIds: readonly string[];
}): Face03Glossary | null {
  if (!input.usedTermIds.length) return null;

  const issues = scanGlossaryAppendixCompliance(
    input.usedTermIds,
    new Set(input.usedTermIds),
  );
  if (issues.length) {
    throw new Error(
      `glossary appendix compliance failed: ${issues.map((i) => i.detail).join("; ")}`,
    );
  }

  const localeKey = input.locale.toLowerCase().slice(0, 2);
  const reading_note =
    READING_NOTE[localeKey] ?? READING_NOTE.en;

  // Validate every id resolves for locale.
  for (const id of input.usedTermIds) {
    if (!resolveTermForLocale(id, input.locale)) {
      throw new Error(`glossary term_id「${id}」missing SSOT soft label for locale`);
    }
  }

  const page = Face03GlossarySchema.parse({
    page: "03",
    face: "03",
    kind: "glossary_appendix",
    page_title:
      localeKey === "zh"
        ? "本报告使用的术语"
        : localeKey === "es"
          ? "Términos usados"
          : localeKey === "fr"
            ? "Termes utilisés"
            : localeKey === "de"
              ? "Verwendete Begriffe"
              : "Terms used in this report",
    page_subtitle: "",
    reading_note,
    term_ids: [...input.usedTermIds],
  });

  return page;
}

/** Resolve glossary rows for UI — soft labels from SSOT only. */
export function resolveGlossaryAppendixRows(
  page: Face03Glossary,
  locale: string,
): Array<{ term_id: string; soft_label: string; definition: string }> {
  const rows: Array<{ term_id: string; soft_label: string; definition: string }> =
    [];
  for (const id of page.term_ids) {
    const resolved = resolveTermForLocale(id, locale);
    if (!resolved) continue;
    rows.push({ term_id: id, ...resolved });
  }
  return rows;
}
