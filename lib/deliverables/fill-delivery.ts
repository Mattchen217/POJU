/**
 * Fill decision-report blank template from delivery full_text (slots only).
 */

import {
  assertSkeletonUnchanged,
  fillDeliverableHtml,
} from "@/lib/deliverables/fill-html";
import {
  decisionReportPanes,
  renderDecisionReportTemplate,
} from "@/lib/deliverables/templates/decision-report";
import {
  deliveryAppendixCopy,
  deliveryEvidenceLabelPlain,
} from "@/lib/llm/pro/delivery/delivery-locale";
import { decisionFaceKicker } from "@/lib/llm/pro/delivery/page-schema/face-kicker";
import { deliveryTopicFromSignals } from "@/lib/llm/pro/delivery/slice-for-page";
import { collectDeliveryEvidenceTerms } from "@/lib/poju/collect-delivery-evidence-terms";
import { buildDeliveryBookPages } from "@/lib/poju/delivery-book-pages";
import {
  deliveryLangAttr,
  deliveryLocaleDisplay,
  escapeDeliveryHtml,
  renderDeliveryPageBodyHtml,
  tocLabelForPage,
  type BuildDeliveryInteractiveHtmlOptions,
} from "@/lib/poju/delivery-interactive-html";
import {
  buildDeliveryShelfSlots,
  type DeliveryShelfSlotId,
} from "@/lib/poju/delivery-shelf-slots";

/** Default download chapters. 07 is absent until decisionReportSlotIds(topic) inserts it. */
export const DECISION_REPORT_SLOT_IDS = decisionReportPanes(null).map((pane) => pane.id);

export function decisionReportSlotIds(topic?: string | null): readonly string[] {
  return decisionReportPanes(topic).map((pane) => pane.id);
}

export type DecisionReportSlotId = string;

function bodySlotKey(id: DecisionReportSlotId): string {
  return `SLOT_BODY_${id.toUpperCase()}`;
}

function tocSlotKey(id: DecisionReportSlotId): string {
  return `SLOT_TOC_${id.toUpperCase()}`;
}

function maybeAssertSkeleton(before: string, after: string): void {
  if (process.env.NODE_ENV === "production") return;
  try {
    assertSkeletonUnchanged(before, after);
  } catch (e) {
    console.warn("[fill-delivery] skeleton assert:", e);
  }
}

function defaultTocLabel(id: DecisionReportSlotId, locale: string): string {
  if (id === "cover") {
    const b = locale.toLowerCase();
    if (b.startsWith("zh")) return "封面";
    if (b.startsWith("es")) return "Portada";
    if (b.startsWith("de")) return "Titelseite";
    if (b.startsWith("fr")) return "Couverture";
    return "Cover";
  }
  if (id === "appendix") return decisionFaceKicker("03", locale);
  return decisionFaceKicker(id, locale);
}

export function buildDeliverySlotMap(
  fullText: string,
  locale: string,
  opts?: BuildDeliveryInteractiveHtmlOptions,
): Record<string, string> {
  const zh = locale.startsWith("zh");
  const topic = deliveryTopicFromSignals({ topic: opts?.topic, question: opts?.originalQuestion });
  const pages = buildDeliveryBookPages(fullText);
  const shelf = buildDeliveryShelfSlots(fullText, {
    locale,
    complete: true,
    topic,
    question: opts?.originalQuestion,
  });
  const slotIds = decisionReportSlotIds(topic);
  const evidenceLabel = deliveryEvidenceLabelPlain(locale);
  const evidenceTerms = collectDeliveryEvidenceTerms(fullText, locale);
  const appendixCopy = deliveryAppendixCopy(locale);

  const coverTitle =
    opts?.title?.trim() ||
    pages.find((p) => p.id === "cover")?.title ||
    (zh ? "能量决策报告" : "Energy Decision Report");

  const question =
    (opts?.originalQuestion || "").trim() ||
    coverTitle
      .replace(/^关于「|」的能量决策报告$/g, "")
      .replace(/^Energy Decision Report ·\s*/i, "")
      .trim();

  const reportId =
    (opts?.reportId || "")
      .trim()
      .replace(/^POJU-/i, "EOS-")
      .replace(/^PIVOT-/i, "EOS-") || "EOS-LOCAL";
  const reportDate = (
    opts?.reportDate || new Date().toISOString().slice(0, 10)
  ).trim();
  const profileLine = (opts?.profileLine || "").trim();

  const privacy = zh
    ? "本文件保存在你的设备上；打开无需登录。"
    : "This file stays on your device; no sign-in required.";
  const disclaimer = zh
    ? "内容供决策参考，不构成医疗、法律或投资建议。"
    : "For decision support only — not medical, legal, or investment advice.";
  const readingHint = zh
    ? "点目录切换章节；依据默认收起。"
    : "Use the TOC to switch chapters; evidence stays collapsed.";

  const hasAudio = Boolean(
    opts?.audioBase64 && opts.audioBase64.trim().length > 32,
  );
  const audioHtml = hasAudio
    ? `<audio id="dib-audio" controls preload="metadata" src="data:${escapeDeliveryHtml(opts?.audioMime || "audio/mpeg")};base64,${opts!.audioBase64!.trim()}"></audio>`
    : "";

  const slots: Record<string, string> = {
    SLOT_LOCALE: escapeDeliveryHtml(deliveryLangAttr(locale)),
    SLOT_TITLE: escapeDeliveryHtml(coverTitle),
    SLOT_QUESTION: escapeDeliveryHtml(question || "—"),
    SLOT_PROFILE: escapeDeliveryHtml(profileLine || "—"),
    SLOT_DATE: escapeDeliveryHtml(reportDate),
    SLOT_REPORT_ID: escapeDeliveryHtml(reportId),
    SLOT_READING_HINT: escapeDeliveryHtml(readingHint),
    SLOT_PRIVACY: escapeDeliveryHtml(privacy),
    SLOT_DISCLAIMER: escapeDeliveryHtml(disclaimer),
    SLOT_PAGE_LABEL: `1 / ${slotIds.length}`,
    SLOT_GLOSSARY_JSON: "[]",
    SLOT_AUDIO_HTML: audioHtml,
  };

  const readyById = new Map<
    DeliveryShelfSlotId,
    Extract<ReturnType<typeof buildDeliveryShelfSlots>[number], { kind: "ready" }>
  >();
  for (const s of shelf) {
    if (s.kind === "ready") readyById.set(s.slotId, s);
  }

  slotIds.forEach((id, pageIndex) => {
    const ready = readyById.get(id as DeliveryShelfSlotId);
    const page = ready?.page;
    const tocLabel = page
      ? tocLabelForPage(page.id, page.title, locale)
      : defaultTocLabel(id, locale);
    slots[tocSlotKey(id)] = escapeDeliveryHtml(tocLabel);
    if (page) {
      slots[bodySlotKey(id)] = renderDeliveryPageBodyHtml(
        {
          id,
          title: page.title,
          body: page.body,
          dualLayer: page.dualLayer,
        },
        {
          locale,
          evidenceLabel,
          evidenceTerms,
          appendixCopy,
          pageIndex,
        },
      );
    } else {
      slots[bodySlotKey(id)] =
        `<div class="delivery-book-stage__section-card"><p class="poju-delivery-v2__p">${escapeDeliveryHtml(zh ? "（本章暂无正文）" : "(No body for this chapter.)")}</p></div>`;
    }
  });

  return slots;
}

export function fillDecisionReportHtml(
  fullText: string,
  locale: string,
  opts?: BuildDeliveryInteractiveHtmlOptions,
): string {
  const topic = deliveryTopicFromSignals({ topic: opts?.topic, question: opts?.originalQuestion });
  const template = renderDecisionReportTemplate(topic);
  const slots = buildDeliverySlotMap(fullText, locale, opts);
  const html = fillDeliverableHtml(template, slots);
  maybeAssertSkeleton(template, html);
  return html;
}
