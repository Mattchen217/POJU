import sys, re, base64, json
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
root = Path(r"D:\POJU\pojulife")
out = root / "lib" / "poju" / "decision-report-html"
out.mkdir(parents=True, exist_ok=True)

css_stage = (root / "styles" / "delivery-book-stage.css").read_text(encoding="utf-8")
css_gloss = (root / "styles" / "glossary.css").read_text(encoding="utf-8")
css_ev = (root / "styles" / "evidence-block.css").read_text(encoding="utf-8")
for name, blob in [("stage", css_stage), ("gloss", css_gloss), ("ev", css_ev)]:
    pass
css_stage = re.sub(r"@import[^;]+;", "", css_stage)
css_gloss = re.sub(r"@import[^;]+;", "", css_gloss)
css_ev = re.sub(r"@import[^;]+;", "", css_ev)

def dui(path, mime):
    return "data:%s;base64,%s" % (mime, base64.b64encode(path.read_bytes()).decode())

PREV = dui(root / "public" / "v2" / "shangicon.svg", "image/svg+xml")
NEXT = dui(root / "public" / "v2" / "xiaicon.svg", "image/svg+xml")
LOGO = dui(root / "public" / "v2" / "LOGOE.png", "image/png")

extra_css = r"""
html, body { margin:0; padding:0; height:100%; overflow:hidden; background:#0B0815; }
.delivery-book-stage { height:100%; min-height:0; }
.delivery-book-stage__header-logo-link { display:inline-flex; align-items:center; gap:8px; text-decoration:none; }
.delivery-book-stage__header-logo-img { height:22px; width:auto; display:block; }
.delivery-book-stage__header-logo-text {
  font-size:0.95rem; font-weight:700; letter-spacing:0.04em;
  background: linear-gradient(135deg, #8a6a1a 0%, #bf953f 16%, #fcf6ba 36%, #d4af37 50%, #fbf5b7 66%, #b38728 82%, #aa771c 100%);
  -webkit-background-clip:text; background-clip:text; color:transparent;
}
.delivery-book-stage__icon-btn img { width:18px; height:18px; display:block; filter: invert(86%) sepia(18%) saturate(600%) hue-rotate(6deg) brightness(95%); }
.eos-decision-close {
  box-sizing:border-box; height:32px; border:1px solid rgba(242,202,80,0.6);
  background: linear-gradient(180deg, #f0d78c 0%, #d4af37 55%, #b8922a 100%);
  color:#14110a; font-weight:600; font-size:0.72rem; padding:0 10px; border-radius:8px;
  box-shadow:0 1px 6px rgba(212,175,55,0.22); line-height:1; display:inline-flex; align-items:center; justify-content:center; cursor:pointer;
}
.eos-decision-close:hover { background: linear-gradient(180deg, #f7e4a8 0%, #e0c04a 55%, #c9a227 100%); }
body[data-embed="1"] .eos-decision-close { display:none !important; }
[data-gloss] { border-bottom:1px dotted rgba(242,202,80,0.45); cursor:help; }
.eos-gloss-pop {
  position:fixed; z-index:10000; max-width:280px; padding:10px 12px; border-radius:10px;
  background:#111827; border:1px solid rgba(242,202,80,0.35); color:#e5e7eb; font-size:12px; line-height:1.45;
  box-shadow:0 12px 32px rgba(0,0,0,0.45); pointer-events:none;
}
.delivery-book-stage__pane { display:none; }
.delivery-book-stage__pane.is-active { display:block; overflow:auto; }
.delivery-book-stage__toc-label { display:block; font-size:13px; line-height:1.35; }
"""

pager_js = r"""
(function(){
  var panes = Array.prototype.slice.call(document.querySelectorAll("[data-slot-pane]"));
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-slot]"));
  var label = document.getElementById("dib-page-label");
  var prev = document.getElementById("dib-prev");
  var next = document.getElementById("dib-next");
  if (!panes.length) return;
  var ids = panes.map(function(p){ return p.getAttribute("data-slot-pane"); });
  function indexOf(id){ var i = ids.indexOf(id); return i < 0 ? 0 : i; }
  function show(id){
    var idx = indexOf(id); id = ids[idx];
    panes.forEach(function(p){ var on = p.getAttribute("data-slot-pane") === id; p.classList.toggle("is-active", on); p.hidden = !on; });
    buttons.forEach(function(b){ var on = b.getAttribute("data-slot") === id; b.classList.toggle("is-active", on); b.classList.toggle("delivery-book-stage__toc-item--active", on); b.classList.toggle("delivery-book-stage__toc-item--ready", !on); });
    if (label) label.textContent = (idx + 1) + " / " + ids.length;
    if (prev) prev.disabled = idx <= 0;
    if (next) next.disabled = idx >= ids.length - 1;
    try { if (history.replaceState) history.replaceState(null, "", "#" + encodeURIComponent(id)); } catch (e) {}
    var active = panes[idx]; if (active) active.scrollTop = 0;
  }
  buttons.forEach(function(b){ b.addEventListener("click", function(){ var id = b.getAttribute("data-slot"); if (id) show(id); }); });
  if (prev) prev.addEventListener("click", function(){ var cur = panes.findIndex(function(p){ return p.classList.contains("is-active"); }); if (cur > 0) show(ids[cur - 1]); });
  if (next) next.addEventListener("click", function(){ var cur = panes.findIndex(function(p){ return p.classList.contains("is-active"); }); if (cur >= 0 && cur < ids.length - 1) show(ids[cur + 1]); });
  var hash = (location.hash || "").replace(/^#/, "");
  var start = hash ? decodeURIComponent(hash) : ids[0];
  if (ids.indexOf(start) < 0) start = ids[0];
  show(start);
  document.querySelectorAll(".evidence-block__toggle").forEach(function(btn){
    btn.addEventListener("click", function(){
      var root = btn.closest(".evidence-block");
      if (!root) return;
      var panel = root.querySelector(".evidence-block__panel");
      var open = root.classList.toggle("evidence-block--open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (panel) panel.hidden = !open;
      var chev = btn.querySelector(".evidence-block__chevron");
      if (chev) chev.textContent = open ? "\u25BE" : "\u25B8";
    });
  });
  var closeBtn = document.getElementById("eos-decision-close");
  if (closeBtn) closeBtn.addEventListener("click", function(){
    try { if (window.parent && window.parent !== window) { window.parent.postMessage({ type: "eastern-os-decision-close" }, "*"); return; } } catch (e) {}
    try { window.close(); } catch (e2) {}
  });
  var pop = null;
  function hidePop(){ if (pop) { pop.remove(); pop = null; } }
  document.addEventListener("mouseover", function(ev){
    var t = ev.target; if (!t || !t.closest) return;
    var el = t.closest("[data-gloss]"); if (!el) return;
    hidePop();
    var text = el.getAttribute("data-gloss") || el.getAttribute("title") || "";
    if (!text) return;
    pop = document.createElement("div"); pop.className = "eos-gloss-pop"; pop.textContent = text;
    document.body.appendChild(pop);
    var r = el.getBoundingClientRect();
    var top = r.bottom + 8; if (top + pop.offsetHeight > window.innerHeight - 8) top = r.top - pop.offsetHeight - 8;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - pop.offsetWidth - 8);
    pop.style.top = top + "px"; pop.style.left = left + "px";
  });
  document.addEventListener("mouseout", function(ev){
    var t = ev.target; if (!t || !t.closest) return;
    if (t.closest("[data-gloss]")) hidePop();
  });
})();
"""

blank = """<!DOCTYPE html>
<html lang="{{SLOT_LANG}}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<meta name="eastern-os-deliverable" content="decision-report"/>
<title>{{SLOT_DOC_TITLE}}</title>
<style>
""" + extra_css + "\n" + css_stage + "\n" + css_gloss + "\n" + css_ev + """
</style>
</head>
<body data-embed="{{SLOT_EMBED}}">
<div class="delivery-book-stage" data-locale="{{SLOT_LOCALE_SHORT}}" data-decision="1" data-bootstrap="1">
  <div class="delivery-book-stage__shell">
    <header class="delivery-book-stage__chrome delivery-book-stage__chrome--header" aria-label="Eastern OS">
      <div class="delivery-book-stage__chrome-left" aria-hidden="true"></div>
      <div class="delivery-book-stage__chrome-center">
        <span class="delivery-book-stage__header-logo-link" aria-label="Eastern OS">
          <img class="delivery-book-stage__header-logo-img" src=\"""" + LOGO + """\" alt="" width="22" height="22"/>
          <span class="delivery-book-stage__header-logo-text">Eastern OS</span>
        </span>
      </div>
      <div class="delivery-book-stage__chrome-right">
        <button type="button" class="eos-decision-close" id="eos-decision-close" aria-label="{{SLOT_CLOSE_LABEL}}">{{SLOT_CLOSE_LABEL}}</button>
      </div>
    </header>
    <div class="delivery-book-stage__card" role="region" aria-label="{{SLOT_CARD_ARIA}}">
      <div class="delivery-book-stage__panes">
        <aside class="delivery-book-stage__left">
          <div class="delivery-book-stage__brand">
            <h1 class="delivery-book-stage__product-title">
              <span>PIVOT</span>
              <span>Breakthrough</span>
              <span class="delivery-book-stage__product-title-line3">Interpretation &amp; Plan</span>
            </h1>
          </div>
          <div class="delivery-book-stage__meta-card">
{{SLOT_META_CARD}}
          </div>
          <nav class="delivery-book-stage__toc" aria-label="{{SLOT_TOC_ARIA}}">
            <div class="delivery-book-stage__toc-head">
              <span class="delivery-book-stage__toc-head-rule" aria-hidden="true"></span>
              {{SLOT_TOC_HEAD}}
            </div>
            <div class="delivery-book-stage__toc-scroll">
              <ol class="delivery-book-stage__toc-list">
{{SLOT_TOC_ITEMS}}
              </ol>
            </div>
          </nav>
          <div class="delivery-book-stage__left-foot">
{{SLOT_LEFT_FOOT}}
          </div>
        </aside>
        <section class="delivery-book-stage__right">
{{SLOT_PANES}}
        </section>
      </div>
    </div>
    <footer class="delivery-book-stage__chrome delivery-book-stage__chrome--footer" role="navigation" aria-label="{{SLOT_FOOTER_ARIA}}">
      <div class="delivery-book-stage__chrome-left"></div>
      <div class="delivery-book-stage__chrome-center">{{SLOT_AUDIO_BLOCK}}</div>
      <div class="delivery-book-stage__chrome-right">
        <div class="delivery-book-stage__pager">
          <button type="button" class="delivery-book-stage__icon-btn" id="dib-prev" aria-label="{{SLOT_PREV_LABEL}}"><img src=\"""" + PREV + """\" alt=""/></button>
          <span class="delivery-book-stage__pager-pos" id="dib-page-label">{{SLOT_PAGE_LABEL}}</span>
          <button type="button" class="delivery-book-stage__icon-btn" id="dib-next" aria-label="{{SLOT_NEXT_LABEL}}"><img src=\"""" + NEXT + """\" alt=""/></button>
        </div>
      </div>
    </footer>
  </div>
</div>
<script>
""" + pager_js + """
</script>
</body>
</html>
"""

(out / "blank-template.html").write_text(blank, encoding="utf-8")
escaped = json.dumps(blank, ensure_ascii=False)
ts = (
    "/** Auto-generated blank template for Eastern OS decision report offline HTML.\n"
    " * Regenerate: python scripts/gen-decision-report-blank-template.py\n"
    " */\n"
    f"export const DECISION_REPORT_BLANK_TEMPLATE: string = {escaped};\n"
)
(out / "blank-template.ts").write_text(ts, encoding="utf-8")
slots = sorted(set(re.findall(r"\{\{SLOT_[A-Z0-9_]+\}\}", blank)))
print("blank html", len(blank))
print("ts bytes", (out / "blank-template.ts").stat().st_size)
print("slots", slots)
