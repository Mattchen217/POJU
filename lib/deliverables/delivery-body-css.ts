/** Decision-report page body styles for deliverable templates. */
export const DELIVERY_BODY_CSS = `
.delivery-book-stage__modules {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 48px;
  width: 100%;
}
.delivery-book-stage__module {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: min(720px, 100%);
  min-width: 0;
}
.delivery-book-stage__section-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 0 20px;
  padding: 0 0 0 28px;
}
.delivery-book-stage__section-dot {
  position: absolute;
  left: 8px;
  top: 0.55em;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fde047;
  box-shadow: 0 0 8px rgba(253, 224, 71, 0.6);
  flex-shrink: 0;
}
.delivery-book-stage__section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 400;
  color: #ffffff;
  line-height: 1.75;
}
.delivery-book-stage__section-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  padding: 28px 32px;
  border-radius: 6px;
  background: #111827;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
.delivery-book-stage__section-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0;
  width: 16px; height: 16px;
  border-top: 1px solid rgba(253, 224, 71, 0.3);
  border-left: 1px solid rgba(253, 224, 71, 0.3);
  border-radius: 6px 0 0 0;
  pointer-events: none;
}
.delivery-book-stage__section-card::after {
  content: "";
  position: absolute;
  bottom: 0; right: 0;
  width: 16px; height: 16px;
  border-bottom: 1px solid rgba(253, 224, 71, 0.3);
  border-right: 1px solid rgba(253, 224, 71, 0.3);
  border-radius: 0 0 6px 0;
  pointer-events: none;
}
.poju-delivery-v2__prose { color: #e5e7eb; }
.poju-delivery-v2__p {
  margin: 0 0 14px;
  font-size: 15px;
  line-height: 1.7;
  color: #e5e7eb;
}
.poju-delivery-v2__p:last-child { margin-bottom: 0; }
.delivery-book-stage__inline-h3 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: #fde047;
}
/* EvidenceBlock 鈥?same as styles/evidence-block.css + delivery-book-stage overrides */
.evidence-block.delivery-book-stage__evidence {
  margin: 0.85rem 0 0;
  border-left: none;
  padding-left: 0;
}
.evidence-block__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: #fde047;
  font: inherit;
  font-size: 0.95em;
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  text-align: left;
}
.evidence-block__chevron {
  display: inline-flex;
  color: #fde047;
  font-weight: 700;
  line-height: 1;
  width: 1em;
}
.evidence-block__label {
  color: #fde047;
  border-bottom: none;
}
.evidence-block__panel {
  margin-top: 10px;
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(11, 15, 18, 0.72);
  border: 1px solid rgba(253, 224, 71, 0.18);
  color: #d1d5db;
  font-size: 14px;
  line-height: 1.7;
  text-align: left;
}
.evidence-block__panel[hidden] { display: none; }
.poju-delivery-v2__evidence-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #d1d5db;
  font-size: 14px;
  line-height: 1.7;
}
.poju-delivery-v2__evidence-body .poju-delivery-v2__prose {
  white-space: normal;
  color: #d1d5db;
  font-size: 14px;
  line-height: 1.7;
}
/* Term marks 鈥?same as styles/glossary.css (page gold letters) */
.term-mark { display: inline; position: relative; }
.term-mark__word { font-weight: 500; white-space: normal; }
.term-mark__word--interactive {
  border-bottom: 1px dotted currentColor;
  border-bottom-color: color-mix(in srgb, currentColor 45%, transparent);
  cursor: help;
}
.term-mark--bracket .term-mark__word--interactive,
.term-mark__word--bracket.term-mark__word--interactive {
  border-bottom-style: dashed;
  letter-spacing: 0.01em;
}
.term-mark--neutral .term-mark__word { color: #c5a880; }
.term-mark--favorable .term-mark__word { color: #7fc4a8; }
.term-mark--caution .term-mark__word { color: #e07a5f; }
.term-mark:not([class*="term-mark--"]) .term-mark__word { color: #d4af37; }
.delivery-book-stage__evidence .term-mark__word { letter-spacing: 0.02em; }
.reading-strong { font-weight: 600; color: #fff; }
.delivery-book-stage__term-lead {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.55;
  color: #9ca3af;
}
.delivery-book-stage__term-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 14px;
  line-height: 1.55;
}
.delivery-book-stage__term-table th,
.delivery-book-stage__term-table td {
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px 12px;
  vertical-align: top;
  text-align: left;
}
.delivery-book-stage__term-table thead th {
  color: #9ca3af;
  font-weight: 500;
  font-size: 12px;
  letter-spacing: 0.06em;
  background: rgba(255, 255, 255, 0.03);
}
.delivery-book-stage__term-table-term {
  width: 28%;
  max-width: 9.5rem;
  color: #d4af37;
  font-weight: 500;
}
.delivery-book-stage__term-table-gloss {
  color: #e5e7eb;
  font-weight: 400;
}
.delivery-energy-dash,
.delivery-thirty-gantt {
  margin: 0 0 20px;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(11, 15, 18, 0.72);
}
.delivery-energy-dash__title,
.delivery-thirty-gantt__title {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 600;
  color: #f2ca50;
}
.delivery-energy-dash__empty { margin: 0; font-size: 13px; color: #9ca3af; }
.delivery-energy-dash__bars { display: flex; flex-direction: column; gap: 12px; }
.delivery-energy-dash__row-head { display: flex; justify-content: space-between; margin-bottom: 6px; gap: 12px; }
.delivery-energy-dash__label { font-size: 13px; color: #e5e7eb; }
.delivery-energy-dash__value { font-size: 13px; color: #f2ca50; font-variant-numeric: tabular-nums; }
.delivery-energy-dash__track { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.06); overflow: hidden; }
.delivery-energy-dash__fill { height: 100%; border-radius: 4px; }
.delivery-energy-dash__row--gold .delivery-energy-dash__fill { background: linear-gradient(90deg, #d4af37, #f2ca50); }
.delivery-energy-dash__row--cyan .delivery-energy-dash__fill { background: linear-gradient(90deg, #0e7490, #9cf0ff); }
.delivery-energy-dash__row--warn .delivery-energy-dash__fill { background: linear-gradient(90deg, #9a3412, #fb923c); }
.delivery-thirty-gantt__scroll { overflow-x: auto; }
.delivery-thirty-gantt__table { width: 100%; min-width: 420px; border-collapse: collapse; font-size: 13px; }
.delivery-thirty-gantt__table th,
.delivery-thirty-gantt__table td { border: 1px solid rgba(255,255,255,0.08); padding: 10px; vertical-align: top; text-align: left; }
.delivery-thirty-gantt__table thead th { font-size: 11px; color: #9ca3af; background: rgba(255,255,255,0.03); }
.delivery-thirty-gantt__table tbody th { width: 28%; font-weight: 500; color: #e5e7eb; background: rgba(0,0,0,0.2); }
.delivery-thirty-gantt__week-num { display: inline-flex; align-items: center; justify-content: center; min-width: 1.5rem; height: 1.5rem; margin-right: 8px; border-radius: 4px; background: rgba(242,202,80,0.15); color: #f2ca50; font-size: 12px; }
.delivery-thirty-gantt__phase { color: #a1a1aa; font-size: 12px; font-weight: 400; }
.delivery-thirty-gantt__list { margin: 0; padding: 0; list-style: none; }
.delivery-thirty-gantt__check { display: flex; align-items: flex-start; gap: 8px; color: #e5e7eb; cursor: pointer; }
.delivery-thirty-gantt__check input { margin-top: 3px; accent-color: #f2ca50; }
`.trim();
