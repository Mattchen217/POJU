/**
 * Phase 5 — single sanitize pipeline for all user-visible export exits
 * (plain / markdown / HTML / email / push / copy).
 *
 * Always mutates via toCompliantPlainText (or HTML text-node walk), then
 * returns structured audit hits (token hash only — never full birth PII).
 */

import { createHash } from "node:crypto";
import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";
import {
  auditOutputPolicyText,
  detectOutputPolicyViolations,
  type OutputPolicyViolation,
} from "@/lib/llm/compliance/audit-output";
import { stripRedlineShenshaFromText } from "@/lib/poju/shensha";

export type ExportSurfaceKind =
  | "plain"
  | "markdown"
  | "html"
  | "email"
  | "push"
  | "copy"
  | "pdf";

export type SanitizeExportDisposition =
  | "passed"
  | "scrubbed"
  | "stripped_redline"
  | "policy_hit"
  | "blocked";

export type SanitizeExportHit = {
  /** SHA-256 prefix of matched snippet — audit only. */
  tokenHash: string;
  namespace: string | null;
  surface: ExportSurfaceKind;
  disposition: SanitizeExportDisposition;
  blocked: boolean;
  /** Violation category / label — never raw chart PII. */
  category: string;
};

export type SanitizeExportAudit = {
  surface: ExportSurfaceKind;
  locale: string;
  hits: SanitizeExportHit[];
  /** True when any hit is blocked or policy residual remains after scrub. */
  blocked: boolean;
  residualViolations: number;
};

export type SanitizeExportResult = {
  content: string;
  audit: SanitizeExportAudit;
};

function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 12);
}

function hitFromViolation(
  v: OutputPolicyViolation,
  surface: ExportSurfaceKind,
  disposition: SanitizeExportDisposition,
  blocked: boolean,
): SanitizeExportHit {
  return {
    tokenHash: hashToken(v.snippet || v.label),
    namespace: v.category === "bazi_term" || v.category === "chart_fingerprint"
      ? "bazi"
      : null,
    surface,
    disposition,
    blocked,
    category: `${v.category}:${v.label}`,
  };
}

/**
 * Sanitize a plain / markdown / copy string through the shared compliance pipeline.
 */
export function sanitizePlainExport(
  text: string,
  locale: string,
  surface: ExportSurfaceKind = "plain",
): SanitizeExportResult {
  const raw = text ?? "";
  if (!raw.trim()) {
    return {
      content: raw,
      audit: {
        surface,
        locale,
        hits: [],
        blocked: false,
        residualViolations: 0,
      },
    };
  }

  const hits: SanitizeExportHit[] = [];
  const beforePolicy = detectOutputPolicyViolations(raw, locale);
  for (const v of beforePolicy) {
    hits.push(hitFromViolation(v, surface, "policy_hit", false));
  }

  const noRedline = stripRedlineShenshaFromText(raw);
  if (noRedline !== raw) {
    hits.push({
      tokenHash: hashToken("redline_shensha"),
      namespace: "bazi",
      surface,
      disposition: "stripped_redline",
      blocked: false,
      category: "shensha:redline_strip",
    });
  }

  const content = toCompliantPlainText(noRedline, locale);
  if (content !== noRedline.trim()) {
    hits.push({
      tokenHash: hashToken("scrub_delta"),
      namespace: null,
      surface,
      disposition: "scrubbed",
      blocked: false,
      category: "compliance:scrub",
    });
  }

  const residual = detectOutputPolicyViolations(content, locale);
  for (const v of residual) {
    hits.push(hitFromViolation(v, surface, "blocked", true));
  }

  // Alert-only structured log (no birth PII).
  if (hits.some((h) => h.blocked || h.disposition === "policy_hit")) {
    auditOutputPolicyText(content, locale, `export:${surface}`);
  }

  return {
    content,
    audit: {
      surface,
      locale,
      hits,
      blocked: residual.length > 0,
      residualViolations: residual.length,
    },
  };
}

/**
 * Walk HTML text nodes + common attribute values; leave tags intact.
 * Does not execute scripts — string transform only.
 */
export function sanitizeHtmlExport(
  html: string,
  locale: string,
  surface: ExportSurfaceKind = "html",
): SanitizeExportResult {
  const raw = html ?? "";
  if (!raw.trim()) {
    return sanitizePlainExport(raw, locale, surface);
  }

  const hits: SanitizeExportHit[] = [];
  let blocked = false;
  let residualViolations = 0;

  const scrubChunk = (chunk: string): string => {
    const r = sanitizePlainExport(chunk, locale, surface);
    hits.push(...r.audit.hits);
    if (r.audit.blocked) blocked = true;
    residualViolations += r.audit.residualViolations;
    return r.content;
  };

  // Protect script/style bodies from mutation.
  const protectedBlocks: string[] = [];
  let working = raw.replace(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (m) => {
      const i = protectedBlocks.length;
      protectedBlocks.push(m);
      return `<!--__POJU_PROT_${i}__-->`;
    },
  );

  // Attribute values that often carry user copy.
  working = working.replace(
    /\b(title|alt|aria-label|placeholder)=("([^"]*)"|'([^']*)')/gi,
    (_m, attr: string, _q: string, dq?: string, sq?: string) => {
      const val = dq ?? sq ?? "";
      if (!val.trim()) return `${attr}=${_q}`;
      const next = scrubChunk(val);
      const quote = dq !== undefined ? `"` : `'`;
      return `${attr}=${quote}${escapeAttr(next)}${quote}`;
    },
  );

  // Text nodes between tags.
  working = working.replace(/>([^<]+)</g, (_m, text: string) => {
    if (!text.trim() || /^[\s\d./\-–—]+$/.test(text)) {
      return `>${text}<`;
    }
    // Skip pure entity/whitespace-ish chunks that are layout chrome.
    if (/^\s*&[a-z]+;\s*$/i.test(text)) return `>${text}<`;
    const next = scrubChunk(text);
    return `>${next}<`;
  });

  working = working.replace(/<!--__POJU_PROT_(\d+)__-->/g, (_m, i: string) => {
    return protectedBlocks[Number(i)] ?? "";
  });

  return {
    content: working,
    audit: {
      surface,
      locale,
      hits,
      blocked,
      residualViolations,
    },
  };
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;");
}

/**
 * Unified entry — pick HTML vs plain by surface kind.
 */
export function sanitizeExportSurface(input: {
  content: string;
  locale: string;
  surface: ExportSurfaceKind;
}): SanitizeExportResult {
  const { content, locale, surface } = input;
  if (surface === "html" || surface === "email") {
    // Email may be HTML body; if it looks like markup, walk nodes.
    if (/<[a-z][\s\S]*>/i.test(content)) {
      return sanitizeHtmlExport(content, locale, surface);
    }
  }
  return sanitizePlainExport(content, locale, surface);
}
