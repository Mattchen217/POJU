# -*- coding: utf-8 -*-
from pathlib import Path
import json
import re

# --- clean WorkspaceDocVaultModal unused ---
path = Path(r"D:\POJU\pojulife\components\workspace\WorkspaceDocVaultModal.tsx")
text = path.read_text(encoding="utf-8")

text = text.replace(
'''import {
  getMatrixSynopsisPlainText,
  resolveMatrixDisplay,
} from "@/lib/poju/matrix-narrative-text";
''',
'')

text = text.replace(
'''function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

''',
'')

text = text.replace(
'  const tBook = useTranslations("workspace.deliveryBook");\n',
'')

text = text.replace(
'  const { email: accountEmail, ready: authReady } = useAuthUser();\n',
'  const { email: accountEmail } = useAuthUser();\n',
)

text = text.replace(
'''  const [emailBusy, setEmailBusy] = useState(false);
  const [packBusy, setPackBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
''',
'''  const [actionMsg, setActionMsg] = useState<string | null>(null);
''',
)

# remove unused const baselineExportLocked if present but keep lock flag comment via message
text = text.replace('  const baselineExportLocked = true;\n', '')

path.write_text(text, encoding="utf-8")
print("cleaned modal")

# --- i18n keys ---
msgs = {
  "en": "Download/email paused until live book export matches the vault popup. Lookalike offline packs are not shipped.",
  "zh": "下载/邮件暂不可用：须等真实书本导出（与弹窗一致）通过验收。不会提供仿制离线包。",
  "es": "Descarga/correo pausados hasta que la exportación en vivo coincida con el popup. No se envían paquetes imitados.",
  "fr": "Téléchargement/e-mail en pause jusqu'à ce que l'export live corresponde au popup. Aucun pack imitant n'est fourni.",
  "de": "Download/E-Mail pausiert, bis der Live-Export dem Popup entspricht. Keine Lookalike-Pakete.",
}

for loc, msg in msgs.items():
    p = Path(rf"D:\POJU\pojulife\messages\{loc}.json")
    data = json.loads(p.read_text(encoding="utf-8"))
    shelf = data["workspace"]["deliveryShelf"]
    shelf["export_live_pending"] = msg
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("i18n", loc)

print("done")
