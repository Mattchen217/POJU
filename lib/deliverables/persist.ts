/**
 * Persist filled deliverable HTML on POJUSessionState (backfill on open).
 */

import { fillBaselineProfileHtml } from "@/lib/deliverables/fill-baseline";
import { fillDecisionReportHtml } from "@/lib/deliverables/fill-delivery";
import { fillReminders30dHtml } from "@/lib/deliverables/fill-reminders";
import type { BuildBaselineInteractiveHtmlOptions } from "@/lib/poju/baseline-interactive-html";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { BuildDeliveryInteractiveHtmlOptions } from "@/lib/poju/delivery-interactive-html";
import type { POJUSessionState } from "@/lib/poju/types";
import type { CompanionJob } from "@/lib/companion/types";

export const TEMPLATE_VERSION = "1";

function localeKey(locale: string): string {
  return (locale || "en").trim().toLowerCase().slice(0, 8);
}

function bagMatches(
  session: POJUSessionState,
  locale: string,
): boolean {
  const bag = session.deliverable_html;
  if (!bag) return false;
  if (bag.template_version !== TEMPLATE_VERSION) return false;
  if (!bag.locale) return false;
  return localeKey(bag.locale) === localeKey(locale);
}

function withBag(
  session: POJUSessionState,
  patch: NonNullable<POJUSessionState["deliverable_html"]>,
  locale: string,
): POJUSessionState {
  return {
    ...session,
    deliverable_html: {
      ...session.deliverable_html,
      ...patch,
      locale: localeKey(locale),
      template_version: TEMPLATE_VERSION,
    },
  };
}

export function ensureBaselineFilledHtml(
  session: POJUSessionState,
  payload: PojuMatrixPayload,
  locale: string,
  opts?: BuildBaselineInteractiveHtmlOptions,
): { session: POJUSessionState; html: string } {
  if (
    bagMatches(session, locale) &&
    session.deliverable_html?.baseline?.trim()
  ) {
    return { session, html: session.deliverable_html.baseline };
  }
  const html = fillBaselineProfileHtml(payload, locale, opts);
  return {
    session: withBag(session, { baseline: html }, locale),
    html,
  };
}

export function ensureDeliveryFilledHtml(
  session: POJUSessionState,
  fullText: string,
  locale: string,
  opts?: BuildDeliveryInteractiveHtmlOptions,
): { session: POJUSessionState; html: string } {
  if (
    bagMatches(session, locale) &&
    session.deliverable_html?.delivery?.trim()
  ) {
    return { session, html: session.deliverable_html.delivery };
  }
  const html = fillDecisionReportHtml(fullText, locale, opts);
  return {
    session: withBag(session, { delivery: html }, locale),
    html,
  };
}

export function ensureRemindersFilledHtml(
  session: POJUSessionState,
  job: CompanionJob,
  locale?: string,
): { session: POJUSessionState; html: string } {
  const loc = locale || job.brief.locale;
  if (
    bagMatches(session, loc) &&
    session.deliverable_html?.reminders?.trim()
  ) {
    return { session, html: session.deliverable_html.reminders };
  }
  // Prefer job-level cache when locale matches.
  if (
    job.filled_html?.trim() &&
    (!job.filled_html_locale ||
      localeKey(job.filled_html_locale) === localeKey(loc))
  ) {
    return {
      session: withBag(session, { reminders: job.filled_html }, loc),
      html: job.filled_html,
    };
  }
  const html = fillReminders30dHtml(job, loc);
  return {
    session: withBag(session, { reminders: html }, loc),
    html,
  };
}
