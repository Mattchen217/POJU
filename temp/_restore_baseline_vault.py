# -*- coding: utf-8 -*-
"""Surgical restore: vault baseline surface -> live BaselinePortraitBook (f3c087f visual).
Keep reminder path-C offline HTML. Stop serving baseline-profile offline HTML in popup.
Download/email for baseline reverts to HEAD simple export (not wrong lookalike pack).
"""
from pathlib import Path

path = Path(r"components\workspace\WorkspaceDocVaultModal.tsx")
text = path.read_text(encoding="utf-8")

# --- 1) Fix imports ---
old_imports = '''import { DeliveryChromeIconBtn } from "@/components/poju/DeliveryChromeIconBtn";
import { DeliveryShelfView } from "@/components/poju/DeliveryShelfView";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import { buildMatrixPayloadFromProfile } from "@/lib/poju/build-matrix-payload";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import {
  baselineProfileOfflineFilename,
  buildBaselineProfileOfflineHtml,
} from "@/lib/poju/baseline-profile-offline-html";
import {
  buildReminderPackOfflineHtml,
  buildReminderPackProgressiveHtml,
  reminderPackOfflineFilename,
} from "@/lib/companion/reminder-day-offline-html";
import type { CompanionJob } from "@/lib/companion/types";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
'''

new_imports = '''import { DeliveryChromeIconBtn } from "@/components/poju/DeliveryChromeIconBtn";
import { DeliveryShelfView } from "@/components/poju/DeliveryShelfView";
import { BaselinePortraitBook } from "@/components/poju/BaselinePortraitBook";
import { useAuthUser } from "@/lib/auth/use-auth-user";
import { buildMatrixPayloadFromProfile } from "@/lib/poju/build-matrix-payload";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import {
  getMatrixSynopsisPlainText,
  resolveMatrixDisplay,
} from "@/lib/poju/matrix-narrative-text";
import {
  buildReminderPackOfflineHtml,
  buildReminderPackProgressiveHtml,
  reminderPackOfflineFilename,
} from "@/lib/companion/reminder-day-offline-html";
import type { CompanionJob } from "@/lib/companion/types";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
'''

if old_imports not in text:
    raise SystemExit("IMPORTS block not found")
text = text.replace(old_imports, new_imports, 1)

# --- 2) Restore escapeHtml + simple baseline export (HEAD) after downloadBlob ---
helper = r'''
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Offline HTML pack for baseline profile (align DeliveryShelf export chrome).
 *  Temporary download/email only — popup surface is live BaselinePortraitBook.
 *  Re-extract from real book tree later (SoT16); do not serve lookalike in UI.
 */
function buildBaselineExportHtml(input: {
  title: string;
  subtitle: string;
  meta: string;
  bodyText: string;
  locale: string;
}): string {
  const zh = input.locale.startsWith("zh");
  const paras = input.bodyText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;line-height:1.65">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("\n");
  return `<!DOCTYPE html>
<html lang="${zh ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(input.title)}</title>
<style>
  body{margin:0;font-family:Georgia,"Songti SC",serif;background:#0a0a12;color:#e8e6df}
  .wrap{max-width:720px;margin:0 auto;padding:32px 20px 48px}
  h1{font-size:1.45rem;margin:0 0 6px;color:#f2ca50}
  .sub{margin:0 0 4px;color:rgba(232,230,223,.72);font-size:.92rem}
  .meta{margin:0 0 22px;color:rgba(161,161,170,.9);font-size:.78rem}
  hr{border:none;border-top:1px solid rgba(242,202,80,.22);margin:0 0 22px}
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(input.title)}</h1>
  <p class="sub">${escapeHtml(input.subtitle)}</p>
  ${input.meta ? `<p class="meta">${escapeHtml(input.meta)}</p>` : ""}
  <hr/>
  ${paras}
</div>
</body>
</html>`;
}

'''

anchor = '  URL.revokeObjectURL(url);\n}\n\n\n/**\n * Vault read overlay'
if anchor not in text:
    # try single newline
    anchor = '  URL.revokeObjectURL(url);\n}\n\n/**\n * Vault read overlay'
    if anchor not in text:
        raise SystemExit("downloadBlob anchor not found")
    text = text.replace(anchor, '  URL.revokeObjectURL(url);\n}\n' + helper + '/**\n * Vault read overlay', 1)
else:
    text = text.replace(anchor, '  URL.revokeObjectURL(url);\n}\n' + helper + '/**\n * Vault read overlay', 1)

# --- 3) Replace filledBaselineHtml + handlers with baselinePack (HEAD-style) ---
# Find from "const filledBaselineHtml" through end of handleBaselineEmail
start = text.find("  const filledBaselineHtml = useMemo(() => {")
if start < 0:
    raise SystemExit("filledBaselineHtml not found")
end_marker = "  const handleReminderDownload = () => {"
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit("handleReminderDownload not found")

replacement = '''  // SoT16 §9: popup surface = live React BaselinePortraitBook (production f3c087f).
  // Do NOT mount baseline-profile offline HTML lookalike in the vault iframe.
  const baselinePack = useMemo(() => {
    if (!matrixPayload) return null;
    const display = resolveMatrixDisplay(matrixPayload, locale);
    const bodyText = getMatrixSynopsisPlainText(display, locale);
    return {
      title: tPortrait("title"),
      subtitle: tPortrait("subtitle"),
      meta: item?.subjectLabel?.trim() || "",
      bodyText,
    };
  }, [matrixPayload, locale, tPortrait, item?.subjectLabel]);

  const handleBaselineDownload = () => {
    if (!baselinePack) return;
    setPackBusy(true);
    setActionMsg(null);
    try {
      const html = buildBaselineExportHtml({ ...baselinePack, locale });
      downloadBlob(
        `baseline-profile-${new Date().toISOString().slice(0, 10)}.html`,
        html,
        "text/html;charset=utf-8",
      );
    } catch (e) {
      console.warn("[vault-modal] baseline download failed", e);
      setActionMsg(tShelf("audio_pack_failed"));
    } finally {
      setPackBusy(false);
    }
  };

  const handleBaselineEmail = async () => {
    if (!baselinePack) return;
    const to = accountEmail?.trim() ?? "";
    if (!authReady) return;
    if (!to || !to.includes("@")) {
      setActionMsg(tShelf("email_no_account"));
      return;
    }
    setEmailBusy(true);
    setActionMsg(null);
    try {
      const html = buildBaselineExportHtml({ ...baselinePack, locale });
      const res = await fetch("/api/poju/delivery-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          title: baselinePack.title,
          body_text: baselinePack.bodyText,
          locale,
          html_attachment: html,
          pack: "baseline",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) {
        setActionMsg(data.error || tBook("email_failed"));
        return;
      }
      setActionMsg(tBook("email_sent"));
    } catch (e) {
      console.warn("[vault-modal] baseline email failed", e);
      setActionMsg(tShelf("audio_pack_failed"));
    } finally {
      setEmailBusy(false);
    }
  };

'''
text = text[:start] + replacement + text[end:]

# --- 4) showBaselineActions: matrixPayload not filledBaselineHtml ---
text = text.replace(
    'const showBaselineActions = Boolean(filledBaselineHtml) && !loading && item.kind === "energy_matrix";',
    'const showBaselineActions = Boolean(matrixPayload) && !loading && item.kind === "energy_matrix";',
    1,
)

# --- 5) Fix header actions JSX: restore always-visible close; keep reminder actions ---
# Replace the broken nested showBaseline/showReminder/close block with clean structure.
old_header = None
# Use a unique start/end around header-actions content
h_start = text.find('          <div className="workspace-doc-vault-modal__header-actions">')
if h_start < 0:
    raise SystemExit("header-actions not found")
h_end = text.find('        </header>', h_start)
if h_end < 0:
    raise SystemExit("header end not found")

new_header = '''          <div className="workspace-doc-vault-modal__header-actions">
            {showBaselineActions ? (
              <div className="workspace-doc-vault-modal__chrome-actions">
                <DeliveryChromeIconBtn
                  src={DOWNLOAD_ICON}
                  label={tShelf("tip_download")}
                  tip={packBusy ? tShelf("audio_generating") : tShelf("tip_download")}
                  disabled={packBusy}
                  onClick={handleBaselineDownload}
                />
                <DeliveryChromeIconBtn
                  src={EMAIL_ICON}
                  label={tShelf("tip_email")}
                  tip={packBusy ? tShelf("audio_generating") : tShelf("tip_email")}
                  disabled={emailBusy || packBusy || !authReady}
                  aria-busy={emailBusy || packBusy || undefined}
                  onClick={() => void handleBaselineEmail()}
                />
                {actionMsg ? (
                  <span className="workspace-doc-vault-modal__action-msg" role="status">
                    {actionMsg}
                  </span>
                ) : null}
              </div>
            ) : null}
            {showReminderActions ? (
              <div className="workspace-doc-vault-modal__chrome-actions">
                <DeliveryChromeIconBtn
                  src={DOWNLOAD_ICON}
                  label={tShelf("tip_download")}
                  tip={packBusy ? tShelf("audio_generating") : tShelf("tip_download")}
                  disabled={packBusy}
                  onClick={handleReminderDownload}
                />
                <DeliveryChromeIconBtn
                  src={EMAIL_ICON}
                  label={tShelf("tip_email")}
                  tip={packBusy ? tShelf("audio_generating") : tShelf("tip_email")}
                  disabled={emailBusy || packBusy || !authReady}
                  aria-busy={emailBusy || packBusy || undefined}
                  onClick={() => void handleReminderEmail()}
                />
                {actionMsg ? (
                  <span className="workspace-doc-vault-modal__action-msg" role="status">
                    {actionMsg}
                  </span>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className={
                item.kind === "energy_matrix"
                  ? "workspace-doc-vault-modal__close workspace-doc-vault-modal__close--primary"
                  : "workspace-doc-vault-modal__close"
              }
              onClick={onClose}
            >
              {tPortrait("close")}
            </button>
          </div>
'''
text = text[:h_start] + new_header + text[h_end:]

# --- 6) Replace baseline iframe with BaselinePortraitBook ---
old_iframe = '''          {filledBaselineHtml && !loading ? (
            <div className="workspace-doc-vault-modal__baseline-frame" data-baseline="1">
              <iframe
                className="workspace-doc-vault-modal__baseline-iframe"
                title={tPortrait("title")}
                srcDoc={filledBaselineHtml}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          ) : null}'''

new_book = '''          {matrixPayload && !loading ? (
            <BaselinePortraitBook
              payload={matrixPayload}
              locale={locale}
              suppressNarrative
            />
          ) : null}'''

if old_iframe not in text:
    raise SystemExit("baseline iframe block not found")
text = text.replace(old_iframe, new_book, 1)

# Sanity: no leftover filledBaselineHtml / buildBaselineProfileOfflineHtml in UI
leftovers = []
for needle in ("filledBaselineHtml", "buildBaselineProfileOfflineHtml", "baselineProfileOfflineFilename", "workspace-doc-vault-modal__baseline-iframe"):
    if needle in text:
        leftovers.append(needle)
if leftovers:
    raise SystemExit(f"leftover refs: {leftovers}")

path.write_text(text, encoding="utf-8", newline="\n")
print("OK patched", path)
print("lines", len(text.splitlines()))
