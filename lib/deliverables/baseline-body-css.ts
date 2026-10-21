/** Baseline page body styles (pcm-*) for deliverable templates. */
export const BASELINE_BODY_CSS = `
.pcm-card {
  padding: 16px 18px; border-radius: 8px;
  background: #111827; border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 6px 20px rgba(0,0,0,0.22);
}
.pcm-label {
  font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
  color: #9ca3af; margin: 0 0 12px; font-weight: 600;
}
.pcm-label--gold { color: #f2ca50; }
.pcm-label--cyan { color: #67e8f9; }
.pcm-label--cyan-soft { color: #a5f3fc; }
.pcm-label--coral { color: #fb923c; }
.pcm-label--sand { color: #d6d3d1; }
.pcm-label--white { color: #e5e7eb; }
.pcm-label--flush { margin-bottom: 8px; }
.pcm-calibration__top {
  display: grid; grid-template-columns: minmax(7.25rem, 9.5rem) minmax(0, 1fr);
  gap: 12px; align-items: stretch; margin: 0 0 14px;
}
.pcm-zodiac {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.4rem; margin: 0; padding: 14px 10px 12px; text-align: center;
  border: 1px solid rgba(255,255,255,0.08); border-radius: 4px;
  background: rgba(255,255,255,0.02); min-height: 100%;
}
.pcm-zodiac__art {
  width: 72px; height: 72px; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; background: rgba(242,202,80,0.08);
  border: 1px solid rgba(242,202,80,0.22);
}
.pcm-zodiac__glyph {
  font-size: 2rem; line-height: 1; color: #fde047;
  font-family: "Songti SC", "Noto Serif SC", Georgia, serif;
}
.pcm-zodiac__emoji { font-size: 1.65rem; line-height: 1; }
.pcm-zodiac__name { font-size: 1.05rem; font-weight: 650; color: #fff; }
.pcm-zodiac__pinyin { font-size: 0.75rem; color: #9ca3af; letter-spacing: 0.04em; }
.pcm-zodiac__year { font-size: 0.8rem; color: #d4af37; font-variant-numeric: tabular-nums; }
.pcm-zodiac__caption { margin: 4px 0 0; font-size: 0.68rem; color: #6b7280; letter-spacing: 0.04em; }
.pcm-hero-strip {
  display: grid; grid-template-columns: 1fr; grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 10px; margin: 0; min-width: 0; height: 100%;
}
.pcm-hero-strip__item {
  border: 1px solid rgba(242,202,80,0.18); border-radius: 12px;
  padding: 12px 12px 10px; background: rgba(255,255,255,0.03);
}
.pcm-hero-strip__value {
  font-size: 1.05rem; font-weight: 650; color: #f4f4f5; line-height: 1.25;
}
.pcm-hero-strip__label {
  margin-top: 6px; font-size: 0.72rem; color: rgba(161,161,170,0.95);
  letter-spacing: 0.04em; text-transform: uppercase;
}
.pcm-cal { margin-top: 0; }
.pcm-cal__grid {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;
}
.pcm-cal__cell {
  padding: 12px; border-radius: 8px; background: rgba(11,15,18,0.55);
  border: 1px solid rgba(255,255,255,0.06);
}
.pcm-cal__kicker { font-size: 11px; color: #9ca3af; margin-bottom: 8px; letter-spacing: 0.04em; }
.pcm-cal__value { font-size: 15px; font-weight: 600; color: #fff; line-height: 1.35; }
.pcm-cal__unit { font-weight: 400; color: #9ca3af; font-size: 0.85em; }
.pcm-cal__sub { margin-top: 4px; font-size: 13px; color: #d1d5db; }
.pcm-cal__foot { margin-top: 10px; }
.pcm-cal__accent { font-size: 12px; color: #f2ca50; }
.pcm-cal__times { display: flex; align-items: center; gap: 10px; }
.pcm-cal__time-val { font-size: 15px; font-weight: 600; color: #fff; font-variant-numeric: tabular-nums; }
.pcm-cal__time-val--dim { color: #a1a1aa; }
.pcm-cal__time-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
.pcm-cal__arrow { color: #6b7280; }
.pcm-cal__delta { margin-top: 8px; font-size: 13px; color: #f2ca50; }
.pcm-cal__note { margin-top: 6px; font-size: 11px; color: #9ca3af; line-height: 1.45; }
.pcm-term__head { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: #9ca3af; margin-top: 8px; }
.pcm-term__track { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.06); overflow: hidden; margin-top: 8px; }
.pcm-term__fill { height: 100%; width: var(--pcm-term-pct, 0%); background: linear-gradient(90deg, #d4af37, #f2ca50); border-radius: 3px; }
.pcm-energy { display: flex; flex-direction: column; gap: 14px; }
.pcm-energy__radar { display: flex; flex-direction: column; align-items: center; }
.pcm-radar__chart { display: flex; justify-content: center; padding: 8px 0; }
.pcm-energy__bottom { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 14px; }
.pcm-energy__rest { display: flex; flex-direction: column; gap: 14px; }
.pcm-bars__list { display: flex; flex-direction: column; gap: 10px; }
.pcm-bar__meta { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
.pcm-bar__name { color: #e5e7eb; }
.pcm-bar__value { color: #f2ca50; font-variant-numeric: tabular-nums; }
.pcm-bar__track { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.06); overflow: hidden; }
.pcm-bar__fill { height: 100%; width: var(--pcm-bar-pct, 0%); border-radius: 4px; }
.pcm-bar__fill--wood { background: linear-gradient(90deg, #166534, #4ade80); }
.pcm-bar__fill--fire { background: linear-gradient(90deg, #9a3412, #fb923c); }
.pcm-bar__fill--earth { background: linear-gradient(90deg, #854d0e, #facc15); }
.pcm-bar__fill--metal { background: linear-gradient(90deg, #64748b, #e2e8f0); }
.pcm-bar__fill--water { background: linear-gradient(90deg, #0e7490, #67e8f9); }
.pcm-bars__footer { margin-top: 12px; }
.pcm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pcm-chip {
  display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px;
  font-size: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #e5e7eb;
}
.pcm-chip--cyan { border-color: rgba(103,232,249,0.35); color: #a5f3fc; }
.pcm-chip--coral { border-color: rgba(251,146,60,0.35); color: #fdba74; }
.pcm-chip--gold { border-color: rgba(242,202,80,0.4); color: #fde047; }
.pcm-chip--neutral { color: #9ca3af; }
.pcm-chip--caps { text-transform: none; }
.pcm-vitality__title { margin: 0 0 12px; font-size: 16px; color: #fff; font-weight: 600; }
.pcm-vtrack { position: relative; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); margin-bottom: 8px; }
.pcm-vtrack__pin {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  width: 14px; height: 14px; border-radius: 50%; background: #fb923c;
  box-shadow: 0 0 10px rgba(251,146,60,0.55);
}
.pcm-vtrack__labels { display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; }
.pcm-eq__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pcm-eq__title { font-size: 14px; color: #fff; margin-bottom: 8px; }
.pcm-eq__pct { color: #f2ca50; }
.pcm-eq__hint { margin-top: 6px; font-size: 11px; }
.pcm-eq__hint--up { color: #4ade80; }
.pcm-eq__hint--down { color: #fb923c; }
.pcm__grid-12 { display: grid; grid-template-columns: 1fr 2fr; gap: 14px; }
.pcm-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pcm-facts-extra { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
.pcm-type-xl { font-size: 1.35rem; font-weight: 650; color: #fff; }
.pcm-type-lg { font-size: 1.05rem; font-weight: 600; color: #fff; }
.pcm-type-body { font-size: 13px; color: #9ca3af; line-height: 1.45; }
.pcm-timeline__list { display: flex; flex-direction: column; gap: 8px; }
.pcm-timeline-row {
  padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
}
.pcm-timeline-row--now {
  border-color: rgba(242,202,80,0.35); background: rgba(242,202,80,0.08);
}
.pcm-timeline-row__range { font-size: 13px; color: #e5e7eb; font-weight: 500; }
.pcm-timeline-row__meta { margin-top: 4px; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; gap: 8px; }
.pcm-timeline-row__el { color: #f2ca50; }
.pcm-layer-stack { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.pcm-layer-row {
  display: grid; grid-template-columns: 4.5rem 1fr auto; gap: 8px; align-items: center;
  font-size: 12px; color: #9ca3af;
}
.pcm-layer-row.is-active { color: #fde047; }
.pcm-layer-row__track { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.06); overflow: hidden; }
.pcm-layer-row__fill { height: 100%; background: linear-gradient(90deg, #d4af37, #fde047); }
.pcm-year-ring {
  margin-top: 10px; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.06); overflow: hidden;
}
.pcm-year-ring__fill { height: 100%; background: linear-gradient(90deg, #0e7490, #67e8f9); }
.pcm-pillars { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 8px; }
.pcm-pl { display: flex; flex-direction: column; gap: 6px; min-height: 140px; }
.pcm-pl.pcm-card--glow { border-color: rgba(242,202,80,0.4); box-shadow: 0 0 18px rgba(242,202,80,0.12); }
.pcm-pl__slot { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #9ca3af; }
.pcm-pl__role { font-size: 13px; color: #f2ca50; }
.pcm-pl__stem { font-size: 1.25rem; font-weight: 700; color: #fff; }
.pcm-pl__stem.el-w { color: #4ade80; }
.pcm-pl__stem.el-f { color: #fb923c; }
.pcm-pl__stem.el-e { color: #facc15; }
.pcm-pl__stem.el-m { color: #e2e8f0; }
.pcm-pl__stem.el-water { color: #67e8f9; }
.pcm-pl__branch { font-size: 13px; color: #d1d5db; }
.pcm-pl__hidden { font-size: 11px; color: #6b7280; }
.pcm-pl__list { margin: 4px 0 0; padding: 0 0 0 1rem; font-size: 11px; color: #a1a1aa; }
.pcm-onset-rail { margin-top: 12px; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.06); position: relative; }
.pcm-onset-rail__mark {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  width: 10px; height: 10px; border-radius: 50%; background: #fb923c;
}
@media (max-width: 900px) {
  .delivery-book-stage { --delivery-inset: 16px; }
  .delivery-book-stage__panes { grid-template-columns: 1fr; }
  .delivery-book-stage__left { max-height: 38%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .delivery-book-stage__chrome { grid-template-columns: 1fr; }
  .delivery-book-stage__chrome-left, .delivery-book-stage__chrome-center, .delivery-book-stage__chrome-right { justify-content: center; }
  .delivery-book-stage__pane { padding: 20px 14px; }
  .pcm-cal__grid, .pcm-energy__bottom, .pcm__grid-12, .pcm-facts, .pcm-facts-extra, .pcm-pillars, .pcm-eq__grid {
    grid-template-columns: 1fr;
  }
  .pcm-calibration__top { grid-template-columns: 1fr; }
  .pcm-hero-strip { grid-template-rows: none; height: auto; }
}
`.trim();
