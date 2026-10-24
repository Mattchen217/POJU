import re, pathlib
sys_path = pathlib.Path(r"D:\POJU\pojulife\lib\poju\delivery-interactive-html.ts")
text = sys_path.read_text(encoding="utf-8")

# Update header - match loosely
text = re.sub(
    r"/\*\*\n \* Phase-4 delivery[\s\S]*?\*/",
    "/**\n * Eastern OS -- decision report offline HTML (popup = file).\n"
    " * Blank template (real delivery-book-stage chrome/CSS/JS/icons) + slot fill from delivery text.\n"
    " * Same string for shelf/vault iframe srcDoc, download, and email attachment.\n */",
    text,
    count=1,
)

needle = 'import { stripShapeExampleChrome } from "@/lib/llm/pro/delivery/display-chrome-strip";\n'
insert = needle + '\nimport { DECISION_REPORT_BLANK_TEMPLATE } from "@/lib/poju/decision-report-html/blank-template";\n'
if "DECISION_REPORT_BLANK_TEMPLATE" not in text:
    if needle not in text:
        raise SystemExit("import needle missing")
    text = text.replace(needle, insert, 1)

text2 = re.sub(
    r"export type BuildDeliveryInteractiveHtmlOptions = DeliveryInteractiveHtmlMeta & \{[\s\S]*?audioMime\?: string;\n\};",
    "export type BuildDeliveryInteractiveHtmlOptions = DeliveryInteractiveHtmlMeta & {\n"
    "  /** Raw MP3/base64 without data: prefix -- wave-2 TTS. */\n"
    "  audioBase64?: string;\n"
    "  /** MIME for embedded audio (default audio/mpeg). */\n"
    "  audioMime?: string;\n"
    "  /** When true, hide gold Close (vault/shelf modal owns Close). */\n"
    "  embed?: boolean;\n"
    "  /** Close button label (file mode). */\n"
    "  closeLabel?: string;\n"
    "};",
    text,
    count=1,
)
if text2 == text:
    raise SystemExit("options replace failed")
text = text2

text3 = re.sub(
    r"/\*\* CSS mirrors[\s\S]*?const CARD_JS = `[\s\S]*?`;\n\n",
    "",
    text,
    count=1,
)
if "const CARD_CSS" in text3 or "const CARD_JS" in text3:
    raise SystemExit("CARD_CSS/JS still present after strip")
text = text3

esc = '''function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}'''
fill = '''function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fillSlots(template: string, slots: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(slots)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  out = out.replace(/\{\{SLOT_[A-Z0-9_]+\}\}/g, "");
  return out;
}'''
if "function fillSlots" not in text:
    if esc not in text:
        raise SystemExit("escapeHtml block missing")
    text = text.replace(esc, fill, 1)

sys_path.write_text(text, encoding="utf-8")
print("phase1 ok", len(text))
print("has CARD", "CARD_CSS" in text, "CARD_JS" in text)
print("has blank import", "DECISION_REPORT_BLANK_TEMPLATE" in text)
print("has fillSlots", "function fillSlots" in text)
print("build fn line", text.find("export function buildDeliveryInteractiveHtml"))