"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { DeliveryBookStage } from "@/components/poju/DeliveryBookStage";
import { DeliveryChromeIconBtn } from "@/components/poju/DeliveryChromeIconBtn";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import { ensureDeliveryFilledHtml } from "@/lib/deliverables";
import {
  DI2_HTML_TEMPLATE_VERSION,
  Di2HtmlExportError,
  di2HtmlContentIdentity,
  fillDi2AuthorityHtml,
  readDi2HtmlPackCache,
  resolveDi2HtmlProseOrder,
  writeDi2HtmlPackCache,
  type Di2HtmlPackCacheEntry,
  type Di2HtmlPackIdentity,
  type Di2HtmlPageAuthority,
} from "@/lib/deliverables/di2-html-authority";
import { DI2_REPORT_SOURCE } from "@/lib/poju/decision-intake/decision-report-types";
import { deliveryTopicFromSignals } from "@/lib/llm/pro/delivery/slice-for-page";
import { buildDeliveryShelfSlots } from "@/lib/poju/delivery-shelf-slots";
import type { PartnerBaziPresence } from "@/lib/poju/dyad-compat";
import type { PivotChartPath } from "@/lib/poju/pivot-chart-path";
import { ensureDeliveryAudio } from "@/lib/poju/ensure-delivery-audio";
import { loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";
import type { POJUSessionState } from "@/lib/poju/types";

import "@/styles/delivery-shelf.css";
import "@/styles/delivery-phase4-ritual.css";

const DOWNLOAD_ICON = "/v2/xiazaiicon.svg";
const EMAIL_ICON = "/v2/emailicon.svg";

const LAST_PAGE_KEY = "poju-delivery-shelf-page";

function lastPageStorageKey(sessionId: string): string {
  return `${LAST_PAGE_KEY}:${sessionId}`;
}

export function readDeliveryShelfLastPage(sessionId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(lastPageStorageKey(sessionId));
    const n = Number.parseInt(raw ?? "0", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeDeliveryShelfLastPage(sessionId: string, pageIndex: number): void {
  try {
    sessionStorage.setItem(lastPageStorageKey(sessionId), String(Math.max(0, pageIndex)));
  } catch {
    // optional
  }
}

type Props = {
  fullText: string;
  locale: string;
  sessionId: string;
  complete: boolean;
  originalQuestion?: string;
  profileId?: string | null;
  /** When set, render via iframe and hide DeliveryBookStage. */
  filledHtml?: string;
  /** When bumped, open book at last-read prose page (from rail icon). */
  openReaderRequest?: number;
  interrupted?: boolean;
  /** Server stop reason (budget / quality) — shown above Continue. */
  interruptReason?: string | null;
  /**
   * Job fuse (wall / continue hops) → Regenerate new report.
   * Soft pause → Continue same job_id.
   */
  interruptAction?: "continue" | "regenerate";
  interruptBusy?: boolean;
  onContinueInterrupted?: () => void;
  onRegenerateInterrupted?: () => void;
  /** Client lost connectivity while server job may still run — auto-recovers on reconnect. */
  networkIssue?: boolean;
};

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DeliveryShelfView({
  fullText,
  locale,
  sessionId,
  complete,
  originalQuestion = "",
  profileId = null,
  filledHtml,
  openReaderRequest = 0,
  interrupted = false,
  interruptReason = null,
  interruptAction = "continue",
  interruptBusy = false,
  onContinueInterrupted,
  onRegenerateInterrupted,
  networkIssue = false,
}: Props) {
  const t = useTranslations("workspace.deliveryShelf");
  const tBook = useTranslations("workspace.deliveryBook");
  const { email: accountEmail, ready: authReady } = useAuthUser();
  const prepare = useWorkspacePojuPrepareOptional();

  const [pathSignals, setPathSignals] = useState<{
    pivotChartPath: PivotChartPath | null;
    partnerBazi: PartnerBaziPresence | null;
    joint: boolean;
    question: string;
  } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [packBusy, setPackBusy] = useState(false);
  const packCacheRef = useRef<Di2HtmlPackCacheEntry | null>(null);
  const [di2Authority, setDi2Authority] = useState<{
    pages: Di2HtmlPageAuthority[];
    report_job_id: string;
    execution_generation: number;
    xhigh_job_id: string;
    freeze_id: string;
    context_hash: string;
    writer_token: string;
  } | null>(null);

  /** Load DI2 page authority + backfill HTML when needed. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await loadPOJUSession(sessionId);
        if (!session || cancelled) return;
        const signals = {
          pivotChartPath: session.pivot_chart_path ?? null,
          partnerBazi: session.partner_bazi ?? null,
          joint: session.joint_decision === true || Boolean(session.joint_decision_id),
          question: session.agent_v2?.original_question ?? "",
        };
        setPathSignals(signals);
        const auth = readDi2AuthorityFromSession(session);
        if (!cancelled) setDi2Authority(auth);

        if (filledHtml?.trim() || !complete || !fullText.trim()) return;
        const shelfTopic = deliveryTopicFromSignals({
          question: originalQuestion || signals.question,
          pivotChartPath: signals.pivotChartPath,
          partnerBazi: signals.partnerBazi,
          joint: signals.joint,
        });
        const pageOrder = auth
          ? (["cover", ...resolveDi2HtmlProseOrder(auth.pages)] as string[])
          : undefined;
        const filled = ensureDeliveryFilledHtml(session, fullText, locale, {
          title: undefined,
          originalQuestion,
          topic: pageOrder ? null : shelfTopic,
          pageOrder,
          reportId: auth?.report_job_id ?? `EOS-${sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
          reportDate: new Date().toISOString().slice(0, 10),
        });
        if (cancelled) return;
        if (filled.session !== session) {
          try {
            await savePOJUSession(filled.session);
          } catch {
            /* viewer still works */
          }
        }
      } catch (e) {
        console.warn("[delivery] backfill html failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filledHtml, complete, fullText, locale, sessionId, originalQuestion]);

  const verifiedProseOrder = useMemo(() => {
    if (!di2Authority?.pages?.length) return null;
    try {
      return resolveDi2HtmlProseOrder(di2Authority.pages);
    } catch {
      return null;
    }
  }, [di2Authority]);

  const prepareSession = prepare?.session?.session_id === sessionId ? prepare.session : null;
  const topic = useMemo(
    () =>
      deliveryTopicFromSignals({
        question: originalQuestion || pathSignals?.question || prepareSession?.agent_v2?.original_question,
        pivotChartPath: pathSignals?.pivotChartPath ?? prepareSession?.pivot_chart_path,
        partnerBazi: pathSignals?.partnerBazi ?? prepareSession?.partner_bazi,
        joint:
          pathSignals?.joint ||
          prepareSession?.joint_decision === true ||
          Boolean(prepareSession?.joint_decision_id),
      }),
    [originalQuestion, pathSignals, prepareSession],
  );

  const coverTitle = useMemo(() => {
    const slots = buildDeliveryShelfSlots(fullText, {
      locale,
      complete,
      topic,
      question: originalQuestion,
      verifiedProseOrder: verifiedProseOrder ?? undefined,
    });
    const cover = slots.find((s) => s.kind === "ready" && s.slotId === "cover");
    return cover && cover.kind === "ready" ? cover.page.title : tBook("title");
  }, [fullText, locale, complete, topic, originalQuestion, verifiedProseOrder, tBook]);

  const handleProseIndexChange = useCallback(
    (index: number) => {
      writeDeliveryShelfLastPage(sessionId, index);
    },
    [sessionId],
  );

  const packIdentity = useMemo((): Di2HtmlPackIdentity | null => {
    if (!di2Authority) return null;
    return {
      report_job_id: di2Authority.report_job_id,
      execution_generation: di2Authority.execution_generation,
      content_identity: di2HtmlContentIdentity(fullText),
      locale,
      template_version: DI2_HTML_TEMPLATE_VERSION,
    };
  }, [di2Authority, fullText, locale]);

  const packOpts = useMemo(
    () => ({
      title: coverTitle,
      originalQuestion,
      topic: verifiedProseOrder ? null : topic,
      pageOrder: verifiedProseOrder
        ? (["cover", ...verifiedProseOrder] as string[])
        : undefined,
      reportId:
        di2Authority?.report_job_id ??
        `EOS-${sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
      reportDate: new Date().toISOString().slice(0, 10),
    }),
    [coverTitle, originalQuestion, topic, verifiedProseOrder, di2Authority, sessionId],
  );

  const resolvePackHtml = async (): Promise<string> => {
    if (!di2Authority || !packIdentity || !verifiedProseOrder) {
      throw new Di2HtmlExportError(
        "di2_authority_required",
        "DI2 verified pages required for HTML export",
      );
    }
    const cached = readDi2HtmlPackCache(packCacheRef.current, packIdentity);
    if (cached) return cached;

    const audio = await ensureDeliveryAudio({ sessionId, fullText, locale });
    const opts = {
      ...packOpts,
      audioBase64: audio.base64,
      audioMime: audio.mime,
    };

    const html = fillDi2AuthorityHtml(fullText, locale, di2Authority.pages, opts);

    let session =
      prepare?.session?.session_id === sessionId
        ? prepare.session
        : await loadPOJUSession(sessionId);
    if (session) {
      const cleared = {
        ...session,
        deliverable_html: session.deliverable_html
          ? { ...session.deliverable_html, delivery: undefined }
          : undefined,
      };
      const filled = ensureDeliveryFilledHtml(cleared, fullText, locale, opts);
      // Prefer the DI2-authority HTML string (same bytes as download/email local pack).
      const artifact = html || filled.html;
      packCacheRef.current = writeDi2HtmlPackCache(packIdentity, artifact);
      try {
        await savePOJUSession({
          ...filled.session,
          deliverable_html: {
            ...filled.session.deliverable_html,
            delivery: artifact,
            locale,
            template_version: DI2_HTML_TEMPLATE_VERSION,
          },
        });
      } catch {
        /* still return html */
      }
      return artifact;
    }

    packCacheRef.current = writeDi2HtmlPackCache(packIdentity, html);
    return html;
  };

  const handleDownloadHtml = () => {
    void (async () => {
      setPackBusy(true);
      setEmailMsg(null);
      try {
        const html = await resolvePackHtml();
        downloadBlob(
          `eastern-os-decision-report-${new Date().toISOString().slice(0, 10)}.html`,
          html,
          "text/html;charset=utf-8",
        );
      } catch (e) {
        console.warn("[delivery] download pack failed", e);
        setEmailMsg(t("audio_pack_failed"));
      } finally {
        setPackBusy(false);
      }
    })();
  };

  const handleSendEmail = async () => {
    const to = accountEmail?.trim() ?? "";
    if (!authReady) return;
    if (!to || !to.includes("@")) {
      setEmailMsg(t("email_no_account"));
      return;
    }
    if (!di2Authority) {
      setEmailMsg(t("audio_pack_failed"));
      return;
    }
    setEmailBusy(true);
    setPackBusy(true);
    setEmailMsg(null);
    try {
      // Warm local pack cache (download/email share the same resolvePackHtml identity).
      await resolvePackHtml();
      const res = await fetch("/api/poju/delivery-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          to,
          locale,
          title: coverTitle,
          pack: "delivery",
          session_id: sessionId,
          job_id: di2Authority.xhigh_job_id,
          writer_token: di2Authority.writer_token,
          expected_execution_generation: di2Authority.execution_generation,
          expected_report_job_id: di2Authority.report_job_id,
          expected_freeze_id: di2Authority.freeze_id,
          expected_context_hash: di2Authority.context_hash,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !data.ok) {
        setEmailMsg(data.error || tBook("email_failed"));
        return;
      }
      setEmailMsg(tBook("email_sent"));
    } catch (e) {
      console.warn("[delivery] email pack failed", e);
      setEmailMsg(t("audio_pack_failed"));
    } finally {
      setEmailBusy(false);
      setPackBusy(false);
    }
  };

  const chromeLeft = complete ? (
    <div className="delivery-book-stage__chrome-actions">
      <DeliveryChromeIconBtn
        src={DOWNLOAD_ICON}
        label={t("tip_download")}
        tip={packBusy ? t("audio_generating") : t("tip_download")}
        disabled={packBusy}
        onClick={handleDownloadHtml}
      />
      <DeliveryChromeIconBtn
        src={EMAIL_ICON}
        label={t("tip_email")}
        tip={packBusy ? t("audio_generating") : t("tip_email")}
        disabled={emailBusy || packBusy || !authReady}
        aria-busy={emailBusy || packBusy || undefined}
        onClick={() => void handleSendEmail()}
      />
      {emailMsg ? (
        <span className="delivery-book-stage__chrome-email-msg" role="status">
          {emailMsg}
        </span>
      ) : null}
    </div>
  ) : null;

  const networkSlot =
    networkIssue && !interrupted ? (
      <div className="delivery-shelf__network" role="status" aria-live="polite">
        <p>{t("network_issue_body")}</p>
      </div>
    ) : null;

  const interruptedSlot =
    interrupted &&
    (interruptAction === "regenerate" ? onRegenerateInterrupted : onContinueInterrupted) ? (
      <div className="poju-delivery-interrupted delivery-shelf__interrupted" role="status">
        <p className="poju-delivery-interrupted__body">
          {interruptAction === "regenerate" ? t("interrupted_fuse_body") : t("interrupted_body")}
        </p>
        {interruptReason ? (
          <p className="poju-delivery-interrupted__reason" role="note">
            {interruptReason}
          </p>
        ) : null}
        <button
          type="button"
          className="poju-delivery-interrupted__btn"
          disabled={interruptBusy}
          onClick={
            interruptAction === "regenerate" ? onRegenerateInterrupted : onContinueInterrupted
          }
        >
          {interruptBusy
            ? interruptAction === "regenerate"
              ? t("interrupted_regenerating")
              : t("interrupted_continuing")
            : interruptAction === "regenerate"
              ? t("interrupted_regenerate")
              : t("interrupted_continue")}
        </button>
      </div>
    ) : null;

  // Popup is the slot flip-book. Filled HTML is download/email only
  // (the iframe used to dump schema JSON and Chinese markdown labels).
  return (
    <DeliveryBookStage
      fullText={fullText}
      locale={locale}
      sessionId={sessionId}
      complete={complete}
      topic={topic}
      verifiedProseOrder={verifiedProseOrder}
      originalQuestion={originalQuestion}
      profileId={profileId}
      jumpRequest={openReaderRequest}
      initialProseIndex={readDeliveryShelfLastPage(sessionId)}
      onProseIndexChange={handleProseIndexChange}
      chromeLeft={chromeLeft}
      networkSlot={networkSlot}
      interruptedSlot={interruptedSlot}
    />
  );
}

function readDi2AuthorityFromSession(session: POJUSessionState): {
  pages: Di2HtmlPageAuthority[];
  report_job_id: string;
  execution_generation: number;
  xhigh_job_id: string;
  freeze_id: string;
  context_hash: string;
  writer_token: string;
} | null {
  const writer_token = session.dc_ledger?.writer_token?.trim() ?? "";
  if (!writer_token) return null;
  const rows = (session.freeze_bound_report_jobs ?? []).filter(
    (j) => j.source === DI2_REPORT_SOURCE && j.status === "completed",
  );
  const job = rows[rows.length - 1];
  if (!job || typeof job.execution_generation !== "number") return null;
  const xhigh_job_id = (job.xhigh_job_id ?? "").trim();
  if (!xhigh_job_id) return null;
  const pages: Di2HtmlPageAuthority[] = job.pages.map((p) => ({
    page_id: p.pageId,
    applicability: p.applicability ?? "applies",
    content_markdown: p.content,
    status: p.status === "completed" ? "completed" : p.status === "failed" ? "failed" : "pending",
    error: p.error ?? null,
  }));
  return {
    pages,
    report_job_id: job.job_id,
    execution_generation: job.execution_generation,
    xhigh_job_id,
    freeze_id: job.binding.freezeId,
    context_hash: job.binding.contentHash,
    writer_token,
  };
}
