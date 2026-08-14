/**
 * Build "1 title + 1 glass card" modules for the delivery book right pane.
 * Pairs body/evidence, then splits body on ### so each argument gets its own card.
 * Always splits ### — even when dualLayer is false (meta / label-missing) — so raw
 * markdown headings never leak into the card body.
 *
 * Evidence attachment: after a body block that expands to N ### cards, the following
 * evidence belongs to that **argument** → attach to the **first** card of the group
 * (not the last). Trailing evidence after multi-### packed bodies otherwise looked
 * like “only the last section has 依据”.
 *
 * P3/P4 Rx: parse **策略:** / **手段:** into strategy/methods for dual-part UI.
 */

import {
  splitProseWithH3,
  splitSectionBlocks,
} from "@/lib/poju/delivery-report-v2-split";
import { parseRxStrategyMethods } from "@/lib/llm/pro/delivery/rx-argument-shape";

export type DeliveryBookModule = {
  title: string;
  /** When true, show timeline node + index number (chapter / first module). */
  showIndex: boolean;
  indexLabel: string;
  body: string;
  evidence: string;
  /** P3/P4 Rx — decision strategy block. */
  strategy?: string;
  /** P3/P4 Rx — methods / levers block. */
  methods?: string;
};

function enrichModuleWithRxParts(mod: DeliveryBookModule): DeliveryBookModule {
  const parsed = parseRxStrategyMethods(mod.body);
  if (!parsed.strategy && !parsed.methods) return mod;
  return {
    ...mod,
    strategy: parsed.strategy,
    methods: parsed.methods,
    body: parsed.remainder,
  };
}

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
      if (current) modules.push(enrichModuleWithRxParts(current));
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
  if (current) modules.push(enrichModuleWithRxParts(current));
  return modules;
}

function appendEvidence(mod: DeliveryBookModule, text: string): void {
  const t = text.trim();
  if (!t) return;
  mod.evidence = mod.evidence ? `${mod.evidence}\n\n${t}` : t;
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
    return modules.filter(
      (m) =>
        m.body.trim() ||
        m.evidence.trim() ||
        Boolean(m.strategy?.trim()) ||
        Boolean(m.methods?.trim()),
    );
  }

  const blocks = splitSectionBlocks(body);
  const modules: DeliveryBookModule[] = [];
  /** Index of first module created by the most recent body block. */
  let lastBodyGroupStart = -1;

  const attachEvidenceToArgumentHead = (text: string) => {
    const t = text.trim();
    if (!t) return;
    if (modules.length === 0) {
      modules.push({
        title: fallbackTitle,
        showIndex: true,
        indexLabel,
        body: "",
        evidence: t,
      });
      lastBodyGroupStart = 0;
      return;
    }
    const targetIdx = lastBodyGroupStart >= 0 ? lastBodyGroupStart : modules.length - 1;
    appendEvidence(modules[targetIdx]!, t);
  };

  for (const blk of blocks) {
    if (blk.kind === "evidence") {
      attachEvidenceToArgumentHead(blk.text);
      continue;
    }

    const groupStart = modules.length;
    const parts = splitProseWithH3(blk.text);
    let current: DeliveryBookModule | null = null;

    for (const part of parts) {
      if (part.kind === "h3") {
        if (current) modules.push(enrichModuleWithRxParts(current));
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
      modules.push(enrichModuleWithRxParts(current));
    }

    if (modules.length > groupStart) {
      lastBodyGroupStart = groupStart;
    }
  }

  if (modules.length === 0 && body.trim()) {
    modules.push(
      enrichModuleWithRxParts({
        title: fallbackTitle,
        showIndex: true,
        indexLabel,
        body: body.trim(),
        evidence: "",
      }),
    );
  }

  if (modules.length > 0) {
    modules[0]!.showIndex = true;
    modules[0]!.indexLabel = indexLabel;
    if (!modules[0]!.title.trim()) modules[0]!.title = fallbackTitle;
  }

  return modules.filter(
    (m) =>
      m.body.trim() ||
      m.evidence.trim() ||
      Boolean(m.strategy?.trim()) ||
      Boolean(m.methods?.trim()),
  );
}
