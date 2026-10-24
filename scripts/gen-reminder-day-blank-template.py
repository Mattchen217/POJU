import sys, re, base64, json
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
root = Path(r"D:\POJU\pojulife")
out = root / "lib" / "companion" / "reminder-day-html"
out.mkdir(parents=True, exist_ok=True)

css_comp = (root / "styles" / "poju-companion.css").read_text(encoding="utf-8")
css_atmos = (root / "temp" / "eos-export" / "atmos-forecast-extract.css").read_text(encoding="utf-8")
css_gloss = (root / "styles" / "glossary.css").read_text(encoding="utf-8")
css_comp = re.sub(r"@import[^;]+;", "", css_comp)
css_gloss = re.sub(r"@import[^;]+;", "", css_gloss)

def dui(path, mime):
    return "data:%s;base64,%s" % (mime, base64.b64encode(path.read_bytes()).decode())

LOGO = dui(root / "public" / "v2" / "LOGOE.png", "image/png")

extra_css = r"""
html, body { margin:0; padding:0; min-height:100%; background:#0c0a09; color:#f5f0e8;
  font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.eos-reminder-shell { max-width: 960px; margin: 0 auto; padding: 20px 16px 40px; }
.eos-reminder-top {
  display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 14px;
}
.eos-reminder-brand { display:inline-flex; align-items:center; gap:8px; }
.eos-reminder-brand img { height:22px; width:auto; display:block; }
.eos-reminder-brand-text {
  font-size:0.95rem; font-weight:700; letter-spacing:0.04em;
  background: linear-gradient(135deg, #8a6a1a 0%, #bf953f 16%, #fcf6ba 36%, #d4af37 50%, #fbf5b7 66%, #b38728 82%, #aa771c 100%);
  -webkit-background-clip:text; background-clip:text; color:transparent;
}
.eos-reminder-close {
  box-sizing:border-box; height:32px; border:1px solid rgba(242,202,80,0.6);
  background: linear-gradient(180deg, #f0d78c 0%, #d4af37 55%, #b8922a 100%);
  color:#14110a; font-weight:600; font-size:0.72rem; padding:0 10px; border-radius:8px;
  cursor:pointer; display:inline-flex; align-items:center;
}
body[data-embed="1"] .eos-reminder-close { display:none !important; }
.eos-reminder-day-only .poju-companion-frame { margin: 0; }
.eos-reminder-pack-note { color:#a8a29e; font-size:0.85rem; margin: 0 0 12px; }
.atmos-forecast__cal { display:flex; flex-direction:column; gap:6px; }
.atmos-forecast__weekdays, .atmos-forecast__row {
  display:grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap:6px;
}
.atmos-forecast__weekday {
  text-align:center; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#a8a29e; padding:4px 0;
}
.atmos-forecast__cell {
  min-height: 72px; border:1px solid #3f3a32; border-radius:10px; background:#161311;
  padding:8px; text-align:left; color:#f5f0e8; cursor:default;
}
.atmos-forecast__cell.is-active { border-color: rgba(212,168,75,0.55); cursor:pointer; }
.atmos-forecast__cell.is-today { box-shadow: inset 0 0 0 1px rgba(231,200,122,0.55); }
.atmos-forecast__cell.is-past { opacity: 0.55; }
.atmos-forecast__cell.is-beyond { opacity: 0.35; }
.atmos-forecast__date { display:flex; align-items:baseline; gap:6px; }
.atmos-forecast__day-num { font-size:1.05rem; font-weight:600; color:#e7c87a; }
.atmos-forecast__month-tag { font-size:0.7rem; color:#a8a29e; }
.atmos-forecast__snippet { margin-top:6px; }
.atmos-forecast__snippet-text {
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
  font-size:0.75rem; line-height:1.35; color:#d6d3d1;
}
.atmos-forecast__expand { display:inline-block; margin-top:4px; font-size:0.7rem; color:#e7c87a; }
.atmos-forecast__pending-row { margin-top:6px; }
.atmos-forecast__pending-label { font-size:0.7rem; color:#78716c; }
.poju-companion-sheet { display:none; }
.poju-companion-sheet.is-open {
  display:flex; position:fixed; inset:0; z-index:80; background:rgba(0,0,0,0.65);
  align-items:center; justify-content:center; padding:20px;
}
[data-gloss] { border-bottom:1px dotted rgba(242,202,80,0.45); cursor:help; }
"""

day_js = r"""
(function(){
  var closeBtn = document.getElementById("eos-reminder-close");
  if (closeBtn) closeBtn.addEventListener("click", function(){
    try { if (window.parent && window.parent !== window) { window.parent.postMessage({ type: "eastern-os-reminder-close" }, "*"); return; } } catch (e) {}
    try { window.close(); } catch (e2) {}
  });
  var sheet = document.getElementById("eos-reminder-sheet");
  var sheetBody = document.getElementById("eos-reminder-sheet-body");
  var sheetTitle = document.getElementById("eos-reminder-sheet-title");
  var days = {};
  try { days = JSON.parse(document.getElementById("eos-reminder-days-json").textContent || "{}"); } catch (e) { days = {}; }
  function openDay(key){
    var d = days[key]; if (!d || !sheet || !sheetBody) return;
    if (sheetTitle) sheetTitle.textContent = d.title || key;
    sheetBody.innerHTML = d.html || "";
    sheet.classList.add("is-open");
  }
  function closeSheet(){ if (sheet) sheet.classList.remove("is-open"); }
  document.querySelectorAll("[data-day-key]").forEach(function(btn){
    btn.addEventListener("click", function(){ var k = btn.getAttribute("data-day-key"); if (k) openDay(k); });
  });
  var sheetClose = document.getElementById("eos-reminder-sheet-close");
  if (sheetClose) sheetClose.addEventListener("click", closeSheet);
  if (sheet) sheet.addEventListener("click", function(ev){ if (ev.target === sheet) closeSheet(); });
  var auto = document.body.getAttribute("data-auto-day");
  if (auto) openDay(auto);
})();
"""

# Single-day blank (drip email / per-day file)
blank_day = """<!DOCTYPE html>
<html lang="{{SLOT_LANG}}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<meta name="eastern-os-deliverable" content="reminder-day"/>
<title>{{SLOT_DOC_TITLE}}</title>
<style>
""" + extra_css + "\n" + css_comp + "\n" + css_gloss + """
</style>
</head>
<body data-embed="{{SLOT_EMBED}}" class="eos-reminder-day-only" data-auto-day="">
<div class="eos-reminder-shell">
  <div class="eos-reminder-top">
    <span class="eos-reminder-brand" aria-label="Eastern OS">
      <img src=\"""" + LOGO + """\" alt="" width="22" height="22"/>
      <span class="eos-reminder-brand-text">Eastern OS</span>
    </span>
    <button type="button" class="eos-reminder-close" id="eos-reminder-close" aria-label="{{SLOT_CLOSE_LABEL}}">{{SLOT_CLOSE_LABEL}}</button>
  </div>
  <section class="poju-companion-frame" aria-label="{{SLOT_FRAME_ARIA}}">
    <header class="poju-companion-frame__header">
      <h2 class="poju-companion-frame__title">{{SLOT_TITLE}}</h2>
      <p class="poju-companion-frame__sub">{{SLOT_SUBTITLE}}</p>
    </header>
    <article class="poju-companion-sheet__card">
{{SLOT_CARD_BODY}}
    </article>
  </section>
</div>
<script>
""" + day_js + """
</script>
</body>
</html>
"""

# Pack blank (vault / download all days with calendar chrome)
blank_pack = """<!DOCTYPE html>
<html lang="{{SLOT_LANG}}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<meta name="eastern-os-deliverable" content="reminder-pack"/>
<title>{{SLOT_DOC_TITLE}}</title>
<style>
""" + extra_css + "\n" + css_comp + "\n" + css_atmos + "\n" + css_gloss + """
</style>
</head>
<body data-embed="{{SLOT_EMBED}}">
<div class="eos-reminder-shell">
  <div class="eos-reminder-top">
    <span class="eos-reminder-brand" aria-label="Eastern OS">
      <img src=\"""" + LOGO + """\" alt="" width="22" height="22"/>
      <span class="eos-reminder-brand-text">Eastern OS</span>
    </span>
    <button type="button" class="eos-reminder-close" id="eos-reminder-close" aria-label="{{SLOT_CLOSE_LABEL}}">{{SLOT_CLOSE_LABEL}}</button>
  </div>
  <section class="poju-companion-frame" aria-label="{{SLOT_FRAME_ARIA}}">
    <header class="poju-companion-frame__header">
      <h2 class="poju-companion-frame__title">{{SLOT_TITLE}}</h2>
      <p class="poju-companion-frame__sub">{{SLOT_SUBTITLE}}</p>
    </header>
    <p class="eos-reminder-pack-note">{{SLOT_PACK_NOTE}}</p>
    <div class="atmos-forecast__cal" role="grid" aria-label="{{SLOT_FRAME_ARIA}}">
{{SLOT_CALENDAR}}
    </div>
  </section>
</div>
<div class="poju-companion-sheet" id="eos-reminder-sheet" role="dialog" aria-modal="true">
  <div class="poju-companion-sheet__panel">
    <header class="poju-companion-sheet__head">
      <h3 id="eos-reminder-sheet-title">{{SLOT_SHEET_TITLE}}</h3>
      <button type="button" id="eos-reminder-sheet-close" aria-label="{{SLOT_CLOSE_LABEL}}">{{SLOT_CLOSE_LABEL}}</button>
    </header>
    <div id="eos-reminder-sheet-body"></div>
  </div>
</div>
<script type="application/json" id="eos-reminder-days-json">{{SLOT_DAYS_JSON}}</script>
<script>
""" + day_js + """
</script>
</body>
</html>
"""

(out / "blank-template-day.html").write_text(blank_day, encoding="utf-8")
(out / "blank-template-pack.html").write_text(blank_pack, encoding="utf-8")

def emit_ts(name, const, blank):
    escaped = json.dumps(blank, ensure_ascii=False)
    ts = (
        f"/** Auto-generated blank template for Eastern OS reminder {name} offline HTML.\\n"
        f" * Regenerate: python scripts/gen-reminder-day-blank-template.py\\n"
        f" */\\n"
        f"export const {const}: string = {escaped};\\n"
    )
    # fix escapes
    ts = (
        f"/** Auto-generated blank template for Eastern OS reminder {name} offline HTML.\n"
        f" * Regenerate: python scripts/gen-reminder-day-blank-template.py\n"
        f" */\n"
        f"export const {const}: string = {escaped};\n"
    )
    (out / f"blank-template-{name}.ts").write_text(ts, encoding="utf-8")

emit_ts("day", "REMINDER_DAY_BLANK_TEMPLATE", blank_day)
emit_ts("pack", "REMINDER_PACK_BLANK_TEMPLATE", blank_pack)
(out / "blank-template.ts").write_text(
    "export { REMINDER_DAY_BLANK_TEMPLATE } from \"./blank-template-day\";\n"
    "export { REMINDER_PACK_BLANK_TEMPLATE } from \"./blank-template-pack\";\n",
    encoding="utf-8",
)
print("day", len(blank_day), "pack", len(blank_pack))
print("day slots", sorted(set(re.findall(r"\{\{SLOT_[A-Z0-9_]+\}\}", blank_day))))
print("pack slots", sorted(set(re.findall(r"\{\{SLOT_[A-Z0-9_]+\}\}", blank_pack))))