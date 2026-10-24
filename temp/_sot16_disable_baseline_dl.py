# -*- coding: utf-8 -*-
"""SoT16 §12 LOCK: disable baseline download/email until live createRoot export passes."""
from pathlib import Path

path = Path(r"D:\POJU\pojulife\components\workspace\WorkspaceDocVaultModal.tsx")
text = path.read_text(encoding="utf-8")

old_import = '''import {
  baselineProfileOfflineFilename,
  buildBaselineProfileOfflineHtml,
} from "@/lib/poju/baseline-profile-offline-html";
'''

new_import = '''// SoT16 §12 LOCK: do not import/serve buildBaselineProfileOfflineHtml (lookalike pack rejected).
// Preferred path: lib/poju/baseline-portrait-live-export.ts (createRoot serialize) — wire when it passes.
// import { baselineProfileOfflineFilename, buildBaselineProfileOfflineHtml } from "@/lib/poju/baseline-profile-offline-html";
'''

if old_import not in text:
    raise SystemExit("import block not found")
text = text.replace(old_import, new_import, 1)

old_block = '''  /** SoT16: download/email uses baseline-profile offline pack (TOC/matrix/paging).
   * Vault popup stays live BaselinePortraitBook. True same-tree extract still TODO. */
  const baselineOfflineHtml = useMemo(() => {
    if (!matrixPayload) return null;
    return buildBaselineProfileOfflineHtml(matrixPayload, locale, {
      subjectLabel: item?.subjectLabel?.trim() || undefined,
      title: tPortrait("title"),
      subtitle: tPortrait("subtitle"),
    });
  }, [matrixPayload, locale, tPortrait, item?.subjectLabel]);

  const baselineEmailBody = useMemo(() => {
    if (!matrixPayload) return "";
    const display = resolveMatrixDisplay(matrixPayload, locale);
    return getMatrixSynopsisPlainText(display, locale);
  }, [matrixPayload, locale]);

  const handleBaselineDownload = () => {
    if (!baselineOfflineHtml) return;
    setPackBusy(true);
    setActionMsg(null);
    try {
      downloadBlob(
        baselineProfileOfflineFilename(),
        baselineOfflineHtml,
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
    if (!baselineOfflineHtml || !matrixPayload) return;
    const to = accountEmail?.trim() ?? "";
    if (!authReady) return;
    if (!to || !to.includes("@")) {
      setActionMsg(tShelf("email_no_account"));
      return;
    }
    setEmailBusy(true);
    setActionMsg(null);
    try {
      const title = tPortrait("title");
      const res = await fetch("/api/poju/delivery-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          title,
          body_text: baselineEmailBody,
          locale,
          html_attachment: baselineOfflineHtml,
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

new_block = '''  /**
   * SoT16 §12 LOCK: download/email disabled until createRoot live BaselinePortraitBook
   * serialize (preferred §11) passes visual acceptance vs vault popup (f3c087f).
   * Do NOT serve blank-template / buildBaselineProfileOfflineHtml lookalike as download.
   */
  const baselineExportLocked = true;
  const baselineExportLockMsg = useMemo(() => {
    try {
      return tShelf("export_live_pending");
    } catch {
      return locale.startsWith("zh")
        ? "下载/邮件暂不可用：须等真实书本导出（与弹窗一致）通过验收。不会提供仿制离线包。"
        : "Download/email paused until live book export matches the vault popup. Lookalike offline packs are not shipped.";
    }
  }, [tShelf, locale]);

  const handleBaselineDownload = () => {
    setActionMsg(baselineExportLockMsg);
  };

  const handleBaselineEmail = async () => {
    setActionMsg(baselineExportLockMsg);
  };
'''

if old_block not in text:
    raise SystemExit("handler block not found")
text = text.replace(old_block, new_block, 1)

# Disable chrome buttons + show lock tip
old_chrome = '''            {showBaselineActions ? (
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
'''

new_chrome = '''            {showBaselineActions ? (
              <div className="workspace-doc-vault-modal__chrome-actions">
                <DeliveryChromeIconBtn
                  src={DOWNLOAD_ICON}
                  label={tShelf("tip_download")}
                  tip={baselineExportLockMsg}
                  disabled
                  onClick={handleBaselineDownload}
                />
                <DeliveryChromeIconBtn
                  src={EMAIL_ICON}
                  label={tShelf("tip_email")}
                  tip={baselineExportLockMsg}
                  disabled
                  aria-busy={undefined}
                  onClick={() => void handleBaselineEmail()}
                />
                <span className="workspace-doc-vault-modal__action-msg" role="status">
                  {actionMsg ?? baselineExportLockMsg}
                </span>
              </div>
            ) : null}
'''

if old_chrome not in text:
    raise SystemExit("chrome block not found")
text = text.replace(old_chrome, new_chrome, 1)

# Drop unused imports that may now be unused (keep resolveMatrixDisplay if still used elsewhere)
# Check remaining uses
for name in ("getMatrixSynopsisPlainText", "resolveMatrixDisplay", "downloadBlob", "packBusy", "emailBusy", "accountEmail", "authReady", "tBook"):
    pass

path.write_text(text, encoding="utf-8")
print("patched", path)
print("getMatrixSynopsisPlainText count", text.count("getMatrixSynopsisPlainText"))
print("resolveMatrixDisplay count", text.count("resolveMatrixDisplay"))
print("downloadBlob count", text.count("downloadBlob"))
print("packBusy count", text.count("packBusy"))
print("emailBusy count", text.count("emailBusy"))
print("tBook count", text.count("tBook"))
print("accountEmail count", text.count("accountEmail"))
