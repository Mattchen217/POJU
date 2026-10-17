const fs = require("fs");
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s, "utf8"); console.log("wrote", p); }

// ---------- understanding-gate-reply.ts ----------
{
  const p = "lib/poju/understanding-gate-reply.ts";
  let s = read(p);

  if (!s.includes("dyadSkipPathUnderstandingNote")) {
    s = s.replace(
      'import { rewriteUnderstandingFieldSecondPerson } from "@/lib/poju/rewrite-understanding-second-person";',
      `import { rewriteUnderstandingFieldSecondPerson } from "@/lib/poju/rewrite-understanding-second-person";
import {
  dyadSkipPathUnderstandingNote,
  shouldAnnotateUnderstandingWithSkipPath,
  type DyadOfferStatus,
  type PartnerBaziPresence,
} from "@/lib/poju/dyad-compat";
import type { PivotChartPath } from "@/lib/poju/pivot-chart-path";`
    );
  }

  // Extend buildUnderstandingGateSummaryFromFields signature
  const oldSig = `export function buildUnderstandingGateSummaryFromFields(
  agent: POJUAgentState,
  locale: string,
): string {`;
  const newSig = `export type UnderstandingGateDyadPathNote = {
  partner_bazi?: PartnerBaziPresence | null;
  pivot_chart_path?: PivotChartPath | null;
  dyad_offer_status?: DyadOfferStatus | null;
};

export function buildUnderstandingGateSummaryFromFields(
  agent: POJUAgentState,
  locale: string,
  dyadPath?: UnderstandingGateDyadPathNote | null,
): string {`;

  if (!s.includes("UnderstandingGateDyadPathNote")) {
    s = s.replace(oldSig, newSig);
  }

  // After bridge is computed, prepend skip note before sections assembly
  // Find: const sections = [
  if (!s.includes("skipPathNote")) {
    s = s.replace(
      "  const sections = [",
      `  const skipPathNote =
    dyadPath &&
    shouldAnnotateUnderstandingWithSkipPath({
      dyadOfferStatus: dyadPath.dyad_offer_status,
      partner_bazi: dyadPath.partner_bazi,
      pivot_chart_path: dyadPath.pivot_chart_path,
    })
      ? dyadSkipPathUnderstandingNote(locale)
      : "";

  const sections = [`
    );

    // Update return to include skipPathNote after bridge
    s = s.replace(
      `  return [
    bridge,
    "",
    ...sections.flatMap((s) => [s, ""]),
    buildSummaryCta(copy, lang),
    "",
    copy.summaryFooter,
  ]`,
      `  return [
    bridge,
    "",
    ...(skipPathNote ? [skipPathNote, ""] : []),
    ...sections.flatMap((s) => [s, ""]),
    buildSummaryCta(copy, lang),
    "",
    copy.summaryFooter,
  ]`
    );
  }

  // Update resolveUnderstandingGateSummaryContent to pass through optional dyadPath
  s = s.replace(
    `export function resolveUnderstandingGateSummaryContent(
  agent: POJUAgentState,
  _modelResponse: string,
  locale: string,
): string {
  return buildUnderstandingGateSummaryFromFields(agent, locale);
}`,
    `export function resolveUnderstandingGateSummaryContent(
  agent: POJUAgentState,
  _modelResponse: string,
  locale: string,
  dyadPath?: UnderstandingGateDyadPathNote | null,
): string {
  return buildUnderstandingGateSummaryFromFields(agent, locale, dyadPath);
}`
  );

  write(p, s);
}

// ---------- opening/display.ts ----------
{
  const p = "lib/poju/phases/opening/display.ts";
  let s = read(p);
  if (!s.includes("dyadPath")) {
    s = s.replace(
      `import { buildUnderstandingGateSummaryFromFields } from "@/lib/poju/understanding-gate-reply";`,
      `import {
  buildUnderstandingGateSummaryFromFields,
  type UnderstandingGateDyadPathNote,
} from "@/lib/poju/understanding-gate-reply";`
    );
    s = s.replace(
      `export type OpeningReplyAssemblyInput = {
  locale: string;
  agent: POJUAgentState;
  llmResponse: string;
  understandingGenerationFailed: boolean;
  phaseAfter: string;
  envelopeFailedStayedOpening: boolean;
};`,
      `export type OpeningReplyAssemblyInput = {
  locale: string;
  agent: POJUAgentState;
  llmResponse: string;
  understandingGenerationFailed: boolean;
  phaseAfter: string;
  envelopeFailedStayedOpening: boolean;
  /** Skip-path UX (#12): annotate understanding confirm when partner chart was skipped. */
  dyadPath?: UnderstandingGateDyadPathNote | null;
};`
    );
    s = s.replace(
      `    return buildUnderstandingGateSummaryFromFields(input.agent, input.locale);`,
      `    return buildUnderstandingGateSummaryFromFields(
      input.agent,
      input.locale,
      input.dyadPath,
    );`
    );
    write(p, s);
  } else {
    console.log("skip opening/display");
  }
}

console.log("part3 understanding+display done");
