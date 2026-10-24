# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"D:\POJU\pojulife\components\workspace\WorkspaceDocVaultModal.tsx")
t = path.read_text(encoding="utf-8")

t = t.replace(
    '  const tShelf = useTranslations("workspace.deliveryShelf");\n  const locale = useLocale();\n  const { email: accountEmail } = useAuthUser();',
    '  const tShelf = useTranslations("workspace.deliveryShelf");\n  const tBook = useTranslations("workspace.deliveryBook");\n  const locale = useLocale();\n  const { email: accountEmail, ready: authReady } = useAuthUser();',
)

old_email = """  const handleBaselineEmail = async () => {
    if (!baselineExportUnlocked) {
      setActionMsg(baselineExportLockMsg);
      return;
    }
    setActionMsg(baselineExportLockMsg);
  };
"""

new_email = """  const handleBaselineEmail = async () => {
    if (!baselineExportUnlocked) {
      setActionMsg(baselineExportLockMsg);
      return;
    }
    if (!matrixPayload || exportBusy) return;
    const to = accountEmail?.trim() ?? "";
    if (!authReady) return;
    if (!to || !to.includes("@")) {
      setActionMsg(tShelf("email_no_account"));
      return;
    }
    setExportBusy(true);
    setActionMsg(null);
    try {
      const html = await runLiveBaselineExport();
      if (!html) throw new Error("empty live export");
      const title = tPortrait("title");
      const res = await fetch("/api/poju/delivery-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          title,
          body_text: title,
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
      console.warn("[vault-modal] live baseline email failed", e);
      setActionMsg(baselineExportLockMsg);
    } finally {
      setExportBusy(false);
    }
  };
"""

if old_email not in t:
    raise SystemExit("email handler not found")
t = t.replace(old_email, new_email, 1)

# Fix corrupted zh fallback to clean UTF-8
import re
t = re.sub(
    r'return locale\.startsWith\("zh"\)\s*\?\s*"[^"]*"\s*:\s*"Download/email paused until live book export matches the vault popup\. Lookalike offline packs are not shipped\.";',
    'return locale.startsWith("zh")\n'
    '        ? "下载/邮件暂不可用：须等真实书本导出（与弹窗一致）通过验收。不会提供仿制离线包。"\n'
    '        : "Download/email paused until live book export matches the vault popup. Lookalike offline packs are not shipped.";',
    t,
    count=1,
)

# email button should also consider authReady when unlocked
t = t.replace(
    "disabled={!baselineExportUnlocked || exportBusy}\n                  aria-busy={exportBusy || undefined}\n                  onClick={() => void handleBaselineEmail()}",
    "disabled={!baselineExportUnlocked || exportBusy || !authReady}\n                  aria-busy={exportBusy || undefined}\n                  onClick={() => void handleBaselineEmail()}",
)

path.write_text(t, encoding="utf-8")
print("email path + authReady restored")
# verify chinese
assert "下载/邮件暂不可用" in path.read_text(encoding="utf-8")
print("zh ok")
