/**
 * Shared delivery-book chrome (CSS + TOC/pager/soft-term JS).
 * Inlined into blank deliverable HTML templates — no external links.
 * Trimmed from lib/poju/baseline-interactive-html.ts CARD_CSS / CARD_JS.
 */

import { BASELINE_BODY_CSS } from "@/lib/deliverables/baseline-body-css";
import { DELIVERY_BODY_CSS } from "@/lib/deliverables/delivery-body-css";

const BOOK_SHELL_CHROME_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; height: 100%; overflow: hidden;
  background: #0B0815; color: #e0e2e8;
  font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.delivery-book-stage {
  --delivery-inset: 64px;
  display: flex; flex-direction: column;
  width: 100%; height: 100%; min-height: 0;
  padding: var(--delivery-inset);
}
.delivery-book-stage__shell {
  position: relative; flex: 1 1 auto; min-height: 0; width: 100%; max-width: 1280px;
  margin: 0 auto; display: flex; flex-direction: column;
  border-radius: 16px; overflow: hidden;
  border: 1px solid rgba(242, 202, 80, 0.35); background: #111827;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(242,202,80,0.12);
}
.delivery-book-stage__card {
  position: relative; z-index: 1; flex: 1 1 auto; min-height: 0; width: 100%;
  display: flex; flex-direction: column; overflow: hidden; background: #111827;
}
.delivery-book-stage__panes {
  display: grid; grid-template-columns: minmax(260px, 380px) 1fr; flex: 1; min-height: 0;
}
.delivery-book-stage__left {
  display: flex; flex-direction: column; gap: 16px;
  padding: 24px 24px 16px; min-height: 0; overflow: hidden;
  background: #0c1219; border-right: 1px solid rgba(255,255,255,0.08);
}
.delivery-book-stage__product-title {
  margin: 0 0 6px; display: flex; flex-direction: column; gap: 6px;
  font-size: clamp(22px, 2.4vw, 32px); font-weight: 700; line-height: 1.12;
  letter-spacing: -0.02em; color: transparent;
  background: linear-gradient(135deg, #8a6a1a 0%, #bf953f 16%, #fcf6ba 36%, #d4af37 50%, #fbf5b7 66%, #b38728 82%, #aa771c 100%);
  background-size: 140% 140%; -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 10px rgba(212,175,55,0.24));
}
.delivery-book-stage__product-title span { display: block; }
.delivery-book-stage__product-title-line3 {
  font-size: 0.88em; letter-spacing: -0.02em; white-space: nowrap;
}
.delivery-book-stage__meta-card {
  display: flex; flex-direction: column; gap: 8px; padding: 10px 12px;
  border-radius: 4px; background: #111827; border: 1px solid rgba(255,255,255,0.08);
}
.delivery-book-stage__meta-question {
  margin: 0; font-size: 13px; line-height: 1.4; font-weight: 500; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.delivery-book-stage__meta-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
.delivery-book-stage__meta-cell { display: inline-flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 0; }
.delivery-book-stage__meta-icon { flex: 0 0 auto; font-size: 12px; color: rgba(255,255,255,0.55); }
.delivery-book-stage__meta-text {
  min-width: 0; font-size: 12px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.delivery-book-stage__toc { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; margin-top: 4px; overflow: hidden; }
.delivery-book-stage__toc-head {
  display: flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: 0.2em;
  text-transform: uppercase; color: #6b7280; margin-bottom: 12px;
}
.delivery-book-stage__toc-head-rule { display: inline-block; width: 12px; height: 1px; background: #6b7280; }
.delivery-book-stage__toc-list {
  list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto; min-height: 0; flex: 1 1 auto;
}
.delivery-book-stage__toc-item {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px 12px;
  border: 0; border-left: 2px solid transparent; border-radius: 4px;
  background: transparent; color: #9ca3af; text-align: left; cursor: pointer; font: inherit;
}
.delivery-book-stage__toc-item:hover { color: #fff; background: rgba(31,41,55,0.5); }
.delivery-book-stage__toc-item--ready { color: #fff; }
.delivery-book-stage__toc-item.is-active,
.delivery-book-stage__toc-item--active {
  color: #fde047; font-weight: 500; background: rgba(253,224,71,0.06);
  border-left-color: #fde047;
}
.delivery-book-stage__toc-num {
  flex: 0 0 auto; width: 1.1em; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #4b5563;
}
.delivery-book-stage__toc-item.is-active .delivery-book-stage__toc-num,
.delivery-book-stage__toc-item--active .delivery-book-stage__toc-num { color: #fde047; }
.delivery-book-stage__toc-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.delivery-book-stage__toc-tag { font-size: 10px; letter-spacing: 0.08em; color: #6b7280; }
.delivery-book-stage__toc-item.is-active .delivery-book-stage__toc-tag,
.delivery-book-stage__toc-item--active .delivery-book-stage__toc-tag { color: rgba(253,224,71,0.75); }
.delivery-book-stage__toc-title {
  font-size: 13px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.delivery-book-stage__left-foot {
  margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);
  font-size: 10px; line-height: 1.45; color: #fff;
}
.delivery-book-stage__left-foot p { margin: 0 0 4px; }
.delivery-book-stage__right {
  position: relative; display: flex; flex-direction: column; min-height: 0; overflow: hidden;
}
.delivery-book-stage__pane {
  display: none; flex: 1 1 auto; min-height: 0; overflow-y: auto;
  padding: 32px 36px 28px; scroll-behavior: smooth;
}
.delivery-book-stage__pane.is-active { display: block; }
.delivery-book-stage__page-title {
  margin: 0 0 8px; font-size: clamp(22px, 2.4vw, 30px); font-weight: 700; line-height: 1.25;
  color: transparent; background: linear-gradient(90deg, #fff 0%, #9ca3af 100%);
  -webkit-background-clip: text; background-clip: text;
}
.delivery-book-stage__page-subtitle { margin: 0 0 28px; font-size: 13px; color: #9ca3af; }
.delivery-book-stage__chrome {
  --delivery-chrome-bg: #1a2336;
  position: relative; z-index: 3; flex: 0 0 auto;
  display: grid; grid-template-columns: minmax(100px, 1fr) minmax(180px, 1.5fr) minmax(120px, 1fr);
  align-items: center; gap: 8px; margin: 0; padding: 4px 14px; min-height: 44px;
  border: none; background: var(--delivery-chrome-bg);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
}
.delivery-book-stage__chrome--header { border-radius: 16px 16px 0 0; border-bottom: 1px solid rgba(148,163,184,0.14); }
.delivery-book-stage__chrome--footer { border-radius: 0 0 16px 16px; border-top: 1px solid rgba(148,163,184,0.14); }
.delivery-book-stage__chrome-left, .delivery-book-stage__chrome-center, .delivery-book-stage__chrome-right {
  display: flex; align-items: center; min-width: 0;
}
.delivery-book-stage__chrome-left { justify-content: flex-start; }
.delivery-book-stage__chrome-center { justify-content: center; }
.delivery-book-stage__chrome-right { justify-content: flex-end; }
.delivery-book-stage__header-logo-text {
  font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.72); font-weight: 600;
}
.delivery-book-stage__pager { display: flex; align-items: center; gap: 4px; }
.delivery-book-stage__icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; padding: 0; border: none; border-radius: 6px;
  background: transparent; color: #fff; cursor: pointer; font-size: 16px; line-height: 1;
}
.delivery-book-stage__icon-btn:hover:not(:disabled) { background: rgba(255,255,255,0.04); }
.delivery-book-stage__icon-btn:disabled { opacity: 0.35; cursor: default; }
.delivery-book-stage__pager-pos {
  font-size: 12px; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.85);
  min-width: 3.5em; text-align: center;
}
.slot-empty {
  margin: 0; padding: 12px 0; color: #6b7280; font-size: 15px; letter-spacing: 0.04em;
}
.soft-term {
  position: relative; cursor: help;
  border-bottom: 1px dotted rgba(242, 202, 80, 0.55);
  color: #fde047;
}
.soft-term[data-gloss]:hover::after,
.soft-term.has-gloss:hover::after {
  content: attr(data-gloss);
  position: absolute; left: 0; bottom: calc(100% + 8px); z-index: 20;
  min-width: 12em; max-width: 22em; padding: 8px 10px;
  border-radius: 6px; border: 1px solid rgba(242, 202, 80, 0.35);
  background: #0c1219; color: #e5e7eb; font-size: 12px; line-height: 1.45;
  font-weight: 400; letter-spacing: 0; white-space: normal;
  box-shadow: 0 8px 24px rgba(0,0,0,0.45);
  pointer-events: none;
}
.day-card {
  margin: 0 0 14px; padding: 16px 18px; border-radius: 8px;
  background: #111827; border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 6px 20px rgba(0,0,0,0.22);
}
.day-card--empty { border-style: dashed; border-color: rgba(255,255,255,0.14); }
.day-card__label {
  margin: 0 0 8px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
  color: #9ca3af; font-weight: 600;
}
.delivery-book-stage--scroll-days .delivery-book-stage__pane--days {
  display: block;
}
.delivery-audio { margin: 0 0 16px; }
@media (max-width: 900px) {
  .delivery-book-stage { --delivery-inset: 16px; }
  .delivery-book-stage__panes { grid-template-columns: 1fr; }
  .delivery-book-stage__left { max-height: 38%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .delivery-book-stage__chrome { grid-template-columns: 1fr; }
  .delivery-book-stage__chrome-left, .delivery-book-stage__chrome-center, .delivery-book-stage__chrome-right { justify-content: center; }
  .delivery-book-stage__pane { padding: 20px 14px; }
}
`.trim();

export const BOOK_SHELL_CSS = `
${BOOK_SHELL_CHROME_CSS}
${BASELINE_BODY_CSS}
${DELIVERY_BODY_CSS}
`.trim();

export const BOOK_SHELL_JS = `
(function(){
  var EMPTY_BODY = '<p class="slot-empty">—</p>';
  // Build mustache patterns at runtime so fillDeliverableHtml cannot rewrite this script.
  function slotRe(name){ return new RegExp("\\\\{\\\\{" + name + "\\\\}\\\\}", "g"); }
  function blankify(html) {
    return html
      .replace(slotRe("SLOT_BODY_[A-Z0-9_]+"), EMPTY_BODY)
      .replace(slotRe("SLOT_DAY_[A-Z0-9_]+"), EMPTY_BODY)
      .replace(slotRe("SLOT_GLOSSARY_JSON"), "[]")
      .replace(slotRe("SLOT_AUDIO_HTML"), "")
      .replace(slotRe("[A-Z][A-Z0-9_]*"), "—");
  }
  var glossSeed = document.getElementById("gloss-data");
  if (glossSeed && glossSeed.textContent && glossSeed.textContent.indexOf("{" + "{") >= 0) {
    glossSeed.textContent = "[]";
  }
  var stage = document.querySelector(".delivery-book-stage");
  var mustacheOpen = "{" + "{SLOT_";
  if (stage && stage.innerHTML.indexOf(mustacheOpen) >= 0) {
    stage.innerHTML = blankify(stage.innerHTML);
  }
  var docLang = document.documentElement.getAttribute("lang") || "";
  if (docLang.indexOf("{" + "{") >= 0) document.documentElement.setAttribute("lang", "en");
  var titleEl = document.querySelector("title");
  if (titleEl && (titleEl.textContent || "").indexOf("{" + "{") >= 0) titleEl.textContent = "—";

  var panes = Array.prototype.slice.call(document.querySelectorAll("[data-slot-pane]"));
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-slot]"));
  var label = document.getElementById("dib-page-label");
  var prev = document.getElementById("dib-prev");
  var next = document.getElementById("dib-next");
  if (!panes.length) return;
  var ids = panes.map(function(p){ return p.getAttribute("data-slot-pane"); });
  function indexOf(id){
    var i = ids.indexOf(id);
    return i < 0 ? 0 : i;
  }
  function show(id){
    var idx = indexOf(id);
    id = ids[idx];
    panes.forEach(function(p){
      var on = p.getAttribute("data-slot-pane") === id;
      p.classList.toggle("is-active", on);
      p.hidden = !on;
    });
    buttons.forEach(function(b){
      var on = b.getAttribute("data-slot") === id;
      b.classList.toggle("is-active", on);
      b.classList.toggle("delivery-book-stage__toc-item--active", on);
      b.classList.toggle("delivery-book-stage__toc-item--ready", !on);
    });
    if (label) label.textContent = (idx + 1) + " / " + ids.length;
    if (prev) prev.disabled = idx <= 0;
    if (next) next.disabled = idx >= ids.length - 1;
    try {
      if (history.replaceState) history.replaceState(null, "", "#" + encodeURIComponent(id));
    } catch (e) {}
    var active = panes[idx];
    if (active) active.scrollTop = 0;
  }
  buttons.forEach(function(b){
    b.addEventListener("click", function(){
      var id = b.getAttribute("data-slot");
      if (id) show(id);
    });
  });
  if (prev) prev.addEventListener("click", function(){
    var cur = panes.findIndex(function(p){ return p.classList.contains("is-active"); });
    if (cur > 0) show(ids[cur - 1]);
  });
  if (next) next.addEventListener("click", function(){
    var cur = panes.findIndex(function(p){ return p.classList.contains("is-active"); });
    if (cur >= 0 && cur < ids.length - 1) show(ids[cur + 1]);
  });
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
      if (chev) chev.textContent = open ? "▾" : "▸";
    });
  });

  try {
    var glossEl = document.getElementById("gloss-data");
    var glossMap = {};
    if (glossEl && glossEl.textContent) {
      var parsed = JSON.parse(glossEl.textContent);
      if (Array.isArray(parsed)) {
        parsed.forEach(function(item){
          if (item && item.term) glossMap[String(item.term)] = String(item.gloss || item.def || "");
        });
      } else if (parsed && typeof parsed === "object") {
        glossMap = parsed;
      }
    }
    Array.prototype.forEach.call(document.querySelectorAll(".soft-term"), function(el){
      var gloss = el.getAttribute("data-gloss");
      if (!gloss) {
        var key = el.getAttribute("data-term") || el.textContent.trim();
        if (key && glossMap[key]) {
          el.setAttribute("data-gloss", glossMap[key]);
        }
      }
      if (el.getAttribute("data-gloss")) {
        el.setAttribute("title", el.getAttribute("data-gloss"));
        el.classList.add("has-gloss");
      }
    });
  } catch (err) {}
})();
`.trim();
