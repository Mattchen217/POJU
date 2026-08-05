/**
 * Build "1 title + 1 glass card" modules for the delivery book right pane.
 * Pairs body/evidence, then splits body on ### so each argument gets its own card.
 * Always splits ### — even when dualLayer is false (meta / label-missing) — so raw
 * markdown headings never leak into the card body.
 */

import {
  splitProseWithH3,
  splitSectionBlocks,
} from "@/lib/poju/delivery-report-v2-split";

export type DeliveryBookModule = {
  title: string;
  /** When true, show timeline node + index number (chapter / first module). */
  showIndex: boolean;
  indexLabel: string;
  body: string;
  evidence: string;
};

function modulesFromBodyBlob(
  body: string,
  fallbackTitle: string,
  indexLabel: string,
): DeliveryBookModule[] {
  const modules: DeliveryBookModule[] = [];
  const parts = splitProseWithH3(body);
  let current: DeliveryBookModule | null = null;

  for (const part of parts) {
    if (part.kind === "h3") {
      if (current) modules.push(current);
      current = {
        title: part.text,
        showIndex: modules.length === 0,
        indexLabel,
        body: "",
        evidence: "",
      };
    } else {
      if (!current) {
        current = {
          title: fallbackTitle,
          showIndex: modules.length === 0,
          indexLabel,
          body: "",
          evidence: "",
        };
      }
      current.body = current.body ? `${current.body}\n\n${part.text}` : part.text;
    }
  }
  if (current) modules.push(current);
  return modules;
}

export function buildDeliveryBookModules(opts: {
  pageTitle: string;
  body: string;
  dualLayer: boolean;
  pageIndex: number;
}): DeliveryBookModule[] {
  const { pageTitle, body, dualLayer, pageIndex } = opts;
  const indexLabel = String(pageIndex + 1).padStart(2, "0");
  const fallbackTitle = pageTitle.trim() || "—";

  if (!dualLayer) {
    const t = body.trim();
    if (!t) return [];
    const modules = modulesFromBodyBlob(t, fallbackTitle, indexLabel);
    if (modules.length === 0) {
      return [
        {
          title: fallbackTitle,
          showIndex: true,
          indexLabel,
          body: t,
          evidence: "",
        },
      ];
    }
    modules[0]!.showIndex = true;
    modules[0]!.indexLabel = indexLabel;
    if (!modules[0]!.title.trim()) modules[0]!.title = fallbackTitle;
    return modules.filter((m) => m.body.trim() || m.evidence.trim());
  }

  const blocks = splitSectionBlocks(body);
  const modules: DeliveryBookModule[] = [];
  let pendingEvidence = "";

  const flushEvidenceOntoLast = () => {
    if (!pendingEvidence || modules.length === 0) {
      pendingEvidence = "";
      return;
    }
    const last = modules[modules.length - 1]!;
    last.evidence = last.evidence
      ? `${last.evidence}\n\n${pendingEvidence}`
      : pendingEvidence;
    pendingEvidence = "";
  };

  for (const blk of blocks) {
    if (blk.kind === "evidence") {
      pendingEvidence = blk.text;
      flushEvidenceOntoLast();
      continue;
    }

    const parts = splitProseWithH3(blk.text);
    let current: DeliveryBookModule | null = null;

    for (const part of parts) {
      if (part.kind === "h3") {
        if (current) modules.push(current);
        current = {
          title: part.text,
          showIndex: modules.length === 0,
          indexLabel,
          body: "",
          evidence: "",
        };
      } else {
        if (!current) {
          current = {
            title: fallbackTitle,
            showIndex: modules.length === 0,
            indexLabel,
            body: "",
            evidence: "",
          };
        }
        current.body = current.body ? `${current.body}\n\n${part.text}` : part.text;
      }
    }

    if (current) {
      modules.push(current);
      flushEvidenceOntoLast();
    } else if (pendingEvidence) {
      // orphan evidence — attach to a page-title card if none yet
      if (modules.length === 0) {
        modules.push({
          title: fallbackTitle,
          showIndex: true,
          indexLabel,
          body: "",
          evidence: pendingEvidence,
        });
        pendingEvidence = "";
      } else {
        flushEvidenceOntoLast();
      }
    }
  }

  // Ensure at least one module when body was empty but we have page title context
  if (modules.length === 0 && body.trim()) {
    modules.push({
      title: fallbackTitle,
      showIndex: true,
      indexLabel,
      body: body.trim(),
      evidence: "",
    });
  }

  // First module always carries the chapter index treatment
  if (modules.length > 0) {
    modules[0]!.showIndex = true;
    modules[0]!.indexLabel = indexLabel;
    if (!modules[0]!.title.trim()) modules[0]!.title = fallbackTitle;
  }

  return modules.filter((m) => m.body.trim() || m.evidence.trim());
}
