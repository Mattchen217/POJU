# -*- coding: utf-8 -*-
from pathlib import Path

# --- annotate old offline html as fallback-only TODO ---
offline = Path(r"D:\POJU\pojulife\lib\poju\baseline-profile-offline-html.ts")
ot = offline.read_text(encoding="utf-8")
banner = """/**
 * TODO(SoT16 §11/§12): LOOKALIKE / blank-template pack — NOT for final download/email acceptance.
 * Max rejected visual vs vault popup (f3c087f). Prefer lib/poju/baseline-portrait-live-export.ts
 * (createRoot live BaselinePortraitBook serialize). Do not re-enable this as the shipped path
 * until live export fails and product explicitly re-accepts a fallback.
 *
 * Eastern OS — personal baseline offline HTML (popup = file).
 * Blank template (chrome/CSS/JS/icons) + slot fill from PojuMatrixPayload.
 * Same string for vault iframe srcDoc, download, and email attachment.
 */

"""
# replace existing header comment block
if "TODO(SoT16" not in ot:
    import re
    ot2 = re.sub(r"^/\*\*[\s\S]*?\*/\s*", banner, ot, count=1)
    offline.write_text(ot2, encoding="utf-8")
    print("annotated offline html")
else:
    print("offline already annotated")

# --- update vault modal to import gate + ready wiring ---
modal = Path(r"D:\POJU\pojulife\components\workspace\WorkspaceDocVaultModal.tsx")
mt = modal.read_text(encoding="utf-8")

old_imp = """// SoT16 §12 LOCK: do not import/serve buildBaselineProfileOfflineHtml (lookalike pack rejected).
// Preferred path: lib/poju/baseline-portrait-live-export.ts (createRoot serialize) — wire when it passes.
// import { baselineProfileOfflineFilename, buildBaselineProfileOfflineHtml } from "@/lib/poju/baseline-profile-offline-html";
"""

# handle possible encoding dash variants
import re
mt2 = re.sub(
    r"// SoT16 §12 LOCK:.*?baseline-profile-offline-html\";\n",
    "",
    mt,
    count=1,
    flags=re.S,
)
if mt2 == mt:
    mt2 = re.sub(
        r"// SoT16 .?12 LOCK:.*?baseline-profile-offline-html\";\n",
        "",
        mt,
        count=1,
        flags=re.S,
    )

new_imp = """import { useMessages } from "next-intl";
import {
  BASELINE_LIVE_EXPORT_VISUAL_PASS,
  captureBaselinePortraitLiveHtml,
} from "@/lib/poju/baseline-portrait-live-export";
// SoT16 §12: lookalike buildBaselineProfileOfflineHtml must NOT be served as download/email.
"""

if "captureBaselinePortraitLiveHtml" not in mt2:
    mt2 = mt2.replace(
        'import { useLocale, useTranslations } from "next-intl";\n',
        'import { useLocale, useTranslations } from "next-intl";\n' + new_imp,
    )
    # fix duplicate useMessages if we also have useLocale line issue
    # remove orphaned old lock comments if still present
    mt2 = re.sub(
        r"// SoT16 .12 LOCK:[\s\S]*?baseline-profile-offline-html\";\n",
        "",
        mt2,
        count=1,
    )

# Ensure useMessages import isn't duplicated awkwardly
if mt2.count("import { useMessages }") > 1:
    # merge into next-intl import
    mt2 = mt2.replace("import { useMessages } from \"next-intl\";\n", "", 1)
    mt2 = mt2.replace(
        'import { useLocale, useTranslations } from "next-intl";',
        'import { useLocale, useMessages, useTranslations } from "next-intl";',
    )
elif "useMessages" in mt2 and 'useMessages, useTranslations' not in mt2 and 'useLocale, useMessages' not in mt2:
    mt2 = mt2.replace(
        'import { useLocale, useTranslations } from "next-intl";\nimport { useMessages } from "next-intl";\n',
        'import { useLocale, useMessages, useTranslations } from "next-intl";\n',
    )

# Replace lock handlers with gated live capture (still disabled when VISUAL_PASS false)
old_handlers = """  /**
   * SoT16 §12 LOCK: download/email disabled until createRoot live BaselinePortraitBook
   * serialize (preferred §11) passes visual acceptance vs vault popup (f3c087f).
   * Do NOT serve blank-template / buildBaselineProfileOfflineHtml lookalike as download.
   */
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
"""

# flexible match for dash encoding
pat = re.compile(
    r"  /\*\*\s*\n   \* SoT16 .12 LOCK:[\s\S]*?const handleBaselineEmail = async \(\) => \{\n    setActionMsg\(baselineExportLockMsg\);\n  \};\n",
)

new_handlers = """  /**
   * SoT16 §12 LOCK: download/email disabled until createRoot live export visual pass.
   * §11 capture is implemented (captureBaselinePortraitLiveHtml); do NOT serve lookalike pack.
   */
  const messages = useMessages();
  const baselineExportUnlocked = BASELINE_LIVE_EXPORT_VISUAL_PASS;
  const baselineExportLockMsg = useMemo(() => {
    try {
      return tShelf("export_live_pending");
    } catch {
      return locale.startsWith("zh")
        ? "下载/邮件暂不可用：须等真实书本导出（与弹窗一致）通过验收。不会提供仿制离线包。"
        : "Download/email paused until live book export matches the vault popup. Lookalike offline packs are not shipped.";
    }
  }, [tShelf, locale]);

  const [exportBusy, setExportBusy] = useState(false);

  const runLiveBaselineExport = async (): Promise<string | null> => {
    if (!matrixPayload) return null;
    const result = await captureBaselinePortraitLiveHtml({
      payload: matrixPayload,
      locale,
      messages,
      subjectLabel: item?.subjectLabel?.trim() || undefined,
      coverTitle: tPortrait("title"),
    });
    return result.html;
  };

  const handleBaselineDownload = () => {
    if (!baselineExportUnlocked) {
      setActionMsg(baselineExportLockMsg);
      return;
    }
    if (!matrixPayload || exportBusy) return;
    setExportBusy(true);
    setActionMsg(null);
    void (async () => {
      try {
        const html = await runLiveBaselineExport();
        if (!html) throw new Error("empty live export");
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const d = new Date();
        const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        a.download = `eastern-os-baseline-profile-live-${stamp}.html`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn("[vault-modal] live baseline export failed", e);
        setActionMsg(baselineExportLockMsg);
      } finally {
        setExportBusy(false);
      }
    })();
  };

  const handleBaselineEmail = async () => {
    if (!baselineExportUnlocked) {
      setActionMsg(baselineExportLockMsg);
      return;
    }
    setActionMsg(baselineExportLockMsg);
  };
"""

mt3, n = pat.subn(new_handlers, mt2, count=1)
if n != 1:
    print("HANDLER_REPLACE_FAILED", n)
    # show snippet around SoT16
    idx = mt2.find("SoT16")
    print(repr(mt2[idx:idx+400]))
else:
    print("handlers replaced")

# Update chrome buttons: disabled when !unlocked
chrome_pat = re.compile(
    r'(src=\{DOWNLOAD_ICON\}[\s\S]*?tip=\{)baselineExportLockMsg(\}[\s\S]*?disabled)(\s*\n\s*onClick=\{handleBaselineDownload\})'
)
# Simpler line-based replace for disabled attrs
mt3 = mt3.replace(
    """                <DeliveryChromeIconBtn
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
""",
    """                <DeliveryChromeIconBtn
                  src={DOWNLOAD_ICON}
                  label={tShelf("tip_download")}
                  tip={
                    baselineExportUnlocked
                      ? tShelf("tip_download")
                      : baselineExportLockMsg
                  }
                  disabled={!baselineExportUnlocked || exportBusy}
                  onClick={handleBaselineDownload}
                />
                <DeliveryChromeIconBtn
                  src={EMAIL_ICON}
                  label={tShelf("tip_email")}
                  tip={
                    baselineExportUnlocked
                      ? tShelf("tip_email")
                      : baselineExportLockMsg
                  }
                  disabled={!baselineExportUnlocked || exportBusy}
                  aria-busy={exportBusy || undefined}
                  onClick={() => void handleBaselineEmail()}
                />
                <span className="workspace-doc-vault-modal__action-msg" role="status">
                  {actionMsg ??
                    (baselineExportUnlocked ? null : baselineExportLockMsg)}
                </span>
""",
)

modal.write_text(mt3, encoding="utf-8")
print("modal updated")
print("has capture import", "captureBaselinePortraitLiveHtml" in mt3)
print("has VISUAL_PASS", "BASELINE_LIVE_EXPORT_VISUAL_PASS" in mt3)
print("has useMessages", "useMessages" in mt3)
