/**
 * Eastern OS — 个人基础画像 offline HTML (popup = file).
 * Blank template (chrome/CSS/JS/icons) + slot fill from PojuMatrixPayload.
 * Same string for vault iframe srcDoc, download, and email attachment.
 */

/** Keep in sync with PojuEnergyMatrix BASELINE_MATRIX_BLOCKS (avoid importing client UI). */
const BASELINE_MATRIX_BLOCKS = [
  { id: "calibration", labelKey: "block_1" },
  { id: "energy", labelKey: "block_2" },
  { id: "trajectory", labelKey: "block_3" },
  { id: "markers", labelKey: "block_4" },
  { id: "core", labelKey: "block_5" },
] as const;

import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { resolveMatrixDisplay } from "@/lib/poju/matrix-narrative-text";
import type { MatrixSynopsisDisplay } from "@/lib/poju/matrix-narrative-text";
import { normalizeMatrixLocale, tMatrix } from "@/lib/poju/poju-matrix-i18n";
import { BASELINE_PROFILE_BLANK_TEMPLATE } from "@/lib/poju/baseline-profile-html/blank-template";

export type BuildBaselineProfileOfflineHtmlOptions = {
  /** Subject / profile label in meta. */
  subjectLabel?: string;
  /** Cover title override. */
  title?: string;
  /** Subtitle override. */
  subtitle?: string;
  /** When true, hide gold Close (vault modal owns Close). */
  embed?: boolean;
  /** Close button label (file mode). */
  closeLabel?: string;
};

function escapeHtml(s: string): string {
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
  // Fail closed: leftover slots become empty (never leak markers to users).
  out = out.replace(/\{\{SLOT_[A-Z0-9_]+\}\}/g, "");
  return out;
}

function glossSpan(text: string, gloss?: string | null): string {
  const t = escapeHtml(text);
  if (!gloss) return t;
  return `<span data-gloss="${escapeHtml(gloss)}" title="${escapeHtml(gloss)}">${t}</span>`;
}

function formatBornLine(payload: PojuMatrixPayload, locale: string): string {
  const profile = payload.user_profile;
  if (!profile?.birth) return "";
  const b = profile.birth;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time =
    profile.tst_meta?.original_time ??
    profile.birth.tst_meta?.original_time ??
    "";
  const date = `${b.year} - ${pad(b.month)} - ${pad(b.day)}`;
  const line = time ? `${date} - ${time}` : date;
  return `${tMatrix(locale, "born")} ${line}`;
}

function formatPlaceLine(payload: PojuMatrixPayload): string {
  const profile = payload.user_profile;
  if (!profile) return "";
  const loc = profile.birth?.birth_location;
  const tstLon = profile.tst_meta?.longitude ?? profile.birth?.tst_meta?.longitude;
  const lon = loc?.longitude ?? tstLon;
  if (loc?.name && lon != null && !loc.use_defaults) {
    const dir = lon >= 0 ? "E" : "W";
    return `${loc.name} ${Math.abs(lon).toFixed(2)}°${dir}`;
  }
  return loc?.name || profile.birth?.timezone || "";
}

function blockTitle(locale: string, labelKey: string): string {
  return tMatrix(locale, `blocks.${labelKey}`);
}

function buildMetaCard(input: {
  bornLine: string;
  placeLine: string;
  localeLabel: string;
  subject: string;
}): string {
  const parts: string[] = [];
  if (input.bornLine) {
    parts.push(
      `<p class="delivery-book-stage__meta-question" title="${escapeHtml(input.bornLine)}">${escapeHtml(input.bornLine)}</p>`,
    );
  }
  parts.push(`<div class="delivery-book-stage__meta-row delivery-book-stage__meta-row--pair">`);
  if (input.placeLine) {
    parts.push(
      `<span class="delivery-book-stage__meta-cell"><span class="delivery-book-stage__meta-icon" aria-hidden="true">◎</span><span class="delivery-book-stage__meta-text">${escapeHtml(input.placeLine)}</span></span>`,
    );
  }
  parts.push(
    `<span class="delivery-book-stage__meta-cell"><span class="delivery-book-stage__meta-icon" aria-hidden="true">文</span><span class="delivery-book-stage__meta-text">${escapeHtml(input.localeLabel)}</span></span>`,
  );
  parts.push(`</div>`);
  if (input.subject) {
    parts.push(
      `<div class="delivery-book-stage__meta-row"><span class="delivery-book-stage__meta-cell"><span class="delivery-book-stage__meta-text">${escapeHtml(input.subject)}</span></span></div>`,
    );
  }
  return parts.join("\n");
}

function buildTocItems(locale: string, activeId: string): string {
  return BASELINE_MATRIX_BLOCKS.map((block, i) => {
    const active = block.id === activeId;
    const cls = active
      ? "delivery-book-stage__toc-item delivery-book-stage__toc-item--active is-active"
      : "delivery-book-stage__toc-item delivery-book-stage__toc-item--ready";
    const label = blockTitle(locale, block.labelKey);
    return `<li><button type="button" class="${cls}" data-slot="${block.id}" aria-label="${escapeHtml(label)}"${active ? ' aria-current="page"' : ""}><span class="delivery-book-stage__toc-num">${String(i + 1).padStart(2, "0")}</span><span class="delivery-book-stage__toc-text"><span class="delivery-book-stage__toc-tag">B${i + 1}</span><span class="delivery-book-stage__toc-title">${escapeHtml(label)}</span></span></button></li>`;
  }).join("\n");
}

function elClass(element: string): string {
  const e = (element || "").toLowerCase();
  if (e.includes("wood") || e.includes("木")) return "el-w";
  if (e.includes("fire") || e.includes("火")) return "el-f";
  if (e.includes("earth") || e.includes("土")) return "el-e";
  if (e.includes("metal") || e.includes("金")) return "el-m";
  if (e.includes("water") || e.includes("水")) return "el-water";
  return "";
}

function renderCalibrationPane(
  display: MatrixSynopsisDisplay,
  locale: string,
  subtitle: string,
  zodiacImgHtml: string,
): string {
  const zh = normalizeMatrixLocale(locale) === "zh";
  const title = blockTitle(locale, "block_1");
  const z = display.zodiac;
  const cal = display.calendar;
  const st = display.solar_term;
  const solarName = zh ? st.name : st.name_en || st.name;
  const heroSolar = `${escapeHtml(solarName)}<span class="pcm-cal__unit"> ${Math.round(st.progress_pct)}%</span>`;
  const signCaption = zh ? "你的生肖 · Your Sign" : "Your Sign";
  const heroCalLabel = zh ? "历法对齐" : "Calendar";
  const heroAdjLabel = zh ? "按出生地调整" : "Birthplace adjust";
  const heroSolarLabel = zh ? "节气位置" : "Solar term";
  // TST delta from pattern if available — show mid line as adjust proxy when no dedicated field
  const adj =
    (display as { tst_delta?: string }).tst_delta ||
    (zh ? "已校准" : "Calibrated");

  return `<section class="delivery-book-stage__pane is-active" data-slot-pane="calibration" id="pane-calibration" aria-label="${escapeHtml(title)}">
  <header class="delivery-book-stage__page-chrome">
    <h1 class="delivery-book-stage__page-title">${escapeHtml(title)}</h1>
    <p class="delivery-book-stage__page-subtitle">${escapeHtml(subtitle)}</p>
  </header>
  <div class="delivery-book-stage__page-slots baseline-portrait-book__page">
    <section class="pcm__section pcm-calibration">
      <div class="pcm-calibration__top" aria-label="${escapeHtml(title)}">
        <div class="pcm-zodiac">
          <div class="pcm-zodiac__art" aria-hidden="true">${zodiacImgHtml}</div>
          <div class="pcm-zodiac__name">${glossSpan(zh ? z.han : z.en, z.note)}</div>
          <div class="pcm-zodiac__pinyin">${escapeHtml(z.pinyin)}</div>
          <div class="pcm-zodiac__year">${escapeHtml(String(display.annual_transit?.year ? "" : ""))}${zh ? escapeHtml(z.han) + "年" : escapeHtml(z.en)}</div>
          <p class="pcm-zodiac__caption">${escapeHtml(signCaption)}</p>
        </div>
        <div class="pcm-hero-strip">
          <div class="pcm-hero-strip__item">
            <div class="pcm-hero-strip__value">${escapeHtml(cal.gregorian)}${cal.lunar ? `<span class="pcm-cal__unit"> · ${escapeHtml(cal.lunar)}</span>` : ""}</div>
            <div class="pcm-hero-strip__label">${escapeHtml(heroCalLabel)}</div>
          </div>
          <div class="pcm-hero-strip__item">
            <div class="pcm-hero-strip__value">${escapeHtml(adj)}</div>
            <div class="pcm-hero-strip__label">${escapeHtml(heroAdjLabel)}</div>
          </div>
          <div class="pcm-hero-strip__item">
            <div class="pcm-hero-strip__value">${heroSolar}</div>
            <div class="pcm-hero-strip__label">${escapeHtml(heroSolarLabel)}</div>
          </div>
        </div>
      </div>
      <div class="pcm-card pcm-cal">
        <div class="pcm-label pcm-label--gold">${escapeHtml(zh ? "校准详情" : "Calibration detail")}</div>
        <div class="pcm-cal__grid">
          <div class="pcm-cal__cell">
            <div class="pcm-cal__kicker">${escapeHtml(tMatrix(locale, "card.calendar_alignment"))}</div>
            <div class="pcm-cal__body">
              <div class="pcm-cal__value">${escapeHtml(cal.gregorian)} <span class="pcm-cal__unit">${escapeHtml(tMatrix(locale, "card.gregorian"))}</span></div>
              ${cal.lunar ? `<div class="pcm-cal__sub">${escapeHtml(cal.lunar)}</div>` : ""}
            </div>
            <div class="pcm-cal__foot"><div class="pcm-cal__accent">${escapeHtml(cal.mid || display.pattern_line)}</div></div>
          </div>
          <div class="pcm-cal__cell">
            <div class="pcm-cal__kicker">${escapeHtml(tMatrix(locale, "card.true_solar_time"))}</div>
            <div class="pcm-cal__body">
              <div class="pcm-cal__note">${escapeHtml(zh ? "出生地真太阳时已写入本次会话坐标。" : "True solar time for birthplace is locked into this session.")}</div>
            </div>
            <div class="pcm-cal__foot"><div class="pcm-cal__accent">${escapeHtml(display.day_master.han)} · ${escapeHtml(display.day_master.en)}</div></div>
          </div>
          <div class="pcm-cal__cell">
            <div class="pcm-cal__kicker">${escapeHtml(tMatrix(locale, "card.solar_term"))}</div>
            <div class="pcm-cal__body">
              <div class="pcm-cal__value">${escapeHtml(solarName)}${st.name_en && zh ? `<span class="pcm-cal__unit"> ${escapeHtml(st.name_en)}</span>` : ""}</div>
              <div class="pcm-term__head"><span>${escapeHtml(st.name)}</span><span>${escapeHtml(st.next_name || "")}</span></div>
              <div class="pcm-term__track"><div class="pcm-term__fill" style="--pcm-term-pct:${Math.max(0, Math.min(100, Math.round(st.progress_pct)))}%"></div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</section>`;
}

function renderEnergyPane(display: MatrixSynopsisDisplay, locale: string, subtitle: string, payload: PojuMatrixPayload): string {
  const zh = normalizeMatrixLocale(locale) === "zh";
  const title = blockTitle(locale, "block_2");
  const scores = payload.wuxing_scores || [];
  const bars = scores
    .map((s) => {
      const name = zh ? s.element_zh || s.element : s.element;
      const pct = Math.max(0, Math.min(100, Math.round(s.pct)));
      return `<div class="pcm-bar"><div class="pcm-bar__meta"><span class="pcm-bar__name">${escapeHtml(name)}</span><span>${pct}</span></div><div class="pcm-bar__track"><div class="pcm-bar__fill" style="width:${pct}%"></div></div></div>`;
    })
    .join("");
  const pillarKeys = ["year", "month", "day", "hour"] as const;
  const pillars = (display.pillars || [])
    .map((pl, idx) => {
      const key = pillarKeys[idx] ?? "year";
      const stem = escapeHtml(pl.stem || "");
      const branch = escapeHtml(pl.branch || "");
      const role = escapeHtml(pl.ten_god || pl.ten_god_en || key);
      const cls = elClass(pl.stem_element || "");
      const glow = key === "day" ? " pcm-card--glow" : "";
      return `<div class="pcm-pl pcm-card${glow}"><div class="pcm-pl__slot">${escapeHtml(key)}</div><div class="pcm-pl__role">${role}</div><div class="pcm-pl__stem ${cls}">${stem}</div><div class="pcm-pl__branch">${branch}</div></div>`;
    })
    .join("");
  return `<section class="delivery-book-stage__pane" data-slot-pane="energy" id="pane-energy" aria-label="${escapeHtml(title)}" hidden>
  <header class="delivery-book-stage__page-chrome">
    <h1 class="delivery-book-stage__page-title">${escapeHtml(title)}</h1>
    <p class="delivery-book-stage__page-subtitle">${escapeHtml(subtitle)}</p>
  </header>
  <div class="delivery-book-stage__page-slots baseline-portrait-book__page">
    <section class="pcm__section pcm-energy">
      <div class="pcm-card">
        <div class="pcm-label pcm-label--cyan">${escapeHtml(tMatrix(locale, "card.elemental_signature"))}</div>
        <div class="pcm-bars__list">${bars}</div>
      </div>
      <div class="pcm-card" style="margin-top:14px">
        <div class="pcm-label pcm-label--gold">${escapeHtml(zh ? "四柱结构" : "Pillar structure")}</div>
        <div class="pcm-pillars">${pillars}</div>
      </div>
      <div class="pcm-card" style="margin-top:14px">
        <div class="pcm-label pcm-label--sand">${escapeHtml(tMatrix(locale, "card.day_master"))}</div>
        <p>${glossSpan(display.day_master.han + " · " + display.day_master.en, display.day_master.element)}</p>
        <p class="pcm-cal__note">${escapeHtml(display.pattern_line)}</p>
      </div>
    </section>
  </div>
</section>`;
}

function renderTrajectoryPane(display: MatrixSynopsisDisplay, locale: string, subtitle: string): string {
  const zh = normalizeMatrixLocale(locale) === "zh";
  const title = blockTitle(locale, "block_3");
  const hub = display.dayun_hub;
  const at = display.annual_transit;
  const age = display.current_age;
  return `<section class="delivery-book-stage__pane" data-slot-pane="trajectory" id="pane-trajectory" aria-label="${escapeHtml(title)}" hidden>
  <header class="delivery-book-stage__page-chrome">
    <h1 class="delivery-book-stage__page-title">${escapeHtml(title)}</h1>
    <p class="delivery-book-stage__page-subtitle">${escapeHtml(subtitle)}</p>
  </header>
  <div class="delivery-book-stage__page-slots baseline-portrait-book__page">
    <section class="pcm__section">
      <div class="pcm-card">
        <div class="pcm-label pcm-label--gold">${escapeHtml(zh ? "生命阶段线 · 时间线" : "Life-stage line")}</div>
        <p>${escapeHtml(hub.theme)} · ${escapeHtml(hub.age_range)} · ${hub.start_year}</p>
        <p class="pcm-cal__note">${zh ? `当前年龄约 ${age}` : `Current age ~${age}`}</p>
      </div>
      <div class="pcm-card" style="margin-top:14px">
        <div class="pcm-label pcm-label--cyan">${escapeHtml(zh ? "年度势能" : "Annual transit")}</div>
        <p>${escapeHtml(String(at.year))} · ${escapeHtml(at.ganzhi)} · ${escapeHtml(at.stem_en)}</p>
        <div class="pcm-term__track"><div class="pcm-term__fill" style="--pcm-term-pct:${Math.round(at.progress_pct)}%"></div></div>
        <p class="pcm-cal__note" style="margin-top:10px">${escapeHtml(at.narrative)}</p>
      </div>
      <div class="pcm-card" style="margin-top:14px">
        <div class="pcm-label pcm-label--sand">${escapeHtml(zh ? "结构动力学" : "Structural dynamics")}</div>
        <p>${escapeHtml(display.structural_dynamics.resonance)}</p>
        <p>${escapeHtml(display.structural_dynamics.tension)}</p>
        <p class="pcm-cal__note">${escapeHtml(display.structural_dynamics.reading)}</p>
      </div>
    </section>
  </div>
</section>`;
}

function chipRow(chips: Array<{ soft?: string; label?: string; text?: string } | string>, tone = "gold"): string {
  return chips
    .map((c) => {
      const text = typeof c === "string" ? c : c.soft || c.label || c.text || "";
      if (!text) return "";
      return `<span class="pcm-chip pcm-chip--${tone}">${escapeHtml(text)}</span>`;
    })
    .join("");
}

function renderMarkersPane(display: MatrixSynopsisDisplay, locale: string, subtitle: string): string {
  const zh = normalizeMatrixLocale(locale) === "zh";
  const title = blockTitle(locale, "block_4");
  const fp = display.fact_panel;
  const era = fp?.era;
  const ys = fp?.year_sign;
  const shensha = (fp?.shensha_highlights || []).map((s) => s.label);
  return `<section class="delivery-book-stage__pane" data-slot-pane="markers" id="pane-markers" aria-label="${escapeHtml(title)}" hidden>
  <header class="delivery-book-stage__page-chrome">
    <h1 class="delivery-book-stage__page-title">${escapeHtml(title)}</h1>
    <p class="delivery-book-stage__page-subtitle">${escapeHtml(subtitle)}</p>
  </header>
  <div class="delivery-book-stage__page-slots baseline-portrait-book__page">
    <section class="pcm__section">
      <div class="pcm-label pcm-label--gold">${escapeHtml(zh ? "扩展读数 · 纪元·岁相·标记·起点" : "Extended readouts")}</div>
      <div class="pcm__grid-12" style="margin-top:10px">
        <div class="pcm-card">
          <div class="pcm-label pcm-label--flush pcm-label--gold">${escapeHtml(zh ? "纪元 · 十年阶段" : "Era · decade")}</div>
          <p>${escapeHtml(era?.theme || display.dayun_hub.theme)}</p>
          <p class="pcm-cal__note">${escapeHtml(era?.age_range || display.dayun_hub.age_range)}</p>
          <div class="pcm-chips" style="margin-top:0.85rem">${chipRow([era?.ten_god_soft, era?.stem_element_soft].filter(Boolean) as string[])}</div>
        </div>
        <div class="pcm-card">
          <div class="pcm-label pcm-label--flush pcm-label--cyan">${escapeHtml(zh ? "岁相" : "Year sign")}</div>
          <p>${escapeHtml(ys?.zodiac_han || display.zodiac.han)} · ${escapeHtml(ys?.zodiac_soft || display.zodiac.en)}</p>
          <div class="pcm-chips">${chipRow([ys?.branch_element_soft].filter(Boolean) as string[], "cyan")}</div>
        </div>
      </div>
      <div class="pcm-card" style="margin-top:14px">
        <div class="pcm-label pcm-label--coral">${escapeHtml(zh ? "标记" : "Markers")}</div>
        <div class="pcm-chips">${chipRow(shensha)}</div>
      </div>
      <div class="pcm-card" style="margin-top:14px">
        <div class="pcm-label pcm-label--sand">${escapeHtml(zh ? "起运" : "Luck onset")}</div>
        <p class="pcm-cal__note">${escapeHtml(
          [fp?.luck_onset?.start_age != null ? (zh ? `起运年龄 ${fp.luck_onset.start_age}` : `Onset age ${fp.luck_onset.start_age}`) : "",
           fp?.luck_onset?.start_year != null ? String(fp.luck_onset.start_year) : "",
           fp?.luck_onset?.start_date || ""].filter(Boolean).join(" · ") || (zh ? "已写入会话" : "Locked in session"),
        )}</p>
      </div>
    </section>
  </div>
</section>`;
}

function renderCorePane(display: MatrixSynopsisDisplay, locale: string, subtitle: string): string {
  const zh = normalizeMatrixLocale(locale) === "zh";
  const title = blockTitle(locale, "block_5");
  const syn = display.synopsis;
  const bal = display.fact_panel?.balance;
  return `<section class="delivery-book-stage__pane" data-slot-pane="core" id="pane-core" aria-label="${escapeHtml(title)}" hidden>
  <header class="delivery-book-stage__page-chrome">
    <h1 class="delivery-book-stage__page-title">${escapeHtml(title)}</h1>
    <p class="delivery-book-stage__page-subtitle">${escapeHtml(subtitle)}</p>
  </header>
  <div class="delivery-book-stage__page-slots baseline-portrait-book__page">
    <section class="pcm__section">
      <div class="pcm-card">
        <div class="pcm-label pcm-label--gold">${escapeHtml(zh ? "底层内核" : "Core kernel")}</div>
        <p>${escapeHtml(syn.archetype)}</p>
        <p style="margin-top:10px">${escapeHtml(syn.friction)}</p>
      </div>
      <div class="pcm-card" style="margin-top:14px">
        <div class="pcm-label pcm-label--cyan">${escapeHtml(tMatrix(locale, "card.elemental_equilibrium"))}</div>
        <p>${escapeHtml(bal?.strength_soft || payloadStrengthFallback(display, locale))}</p>
        <div class="pcm-chips" style="margin-top:8px">${chipRow((bal?.xi || []).map((c) => c.soft || ""), "cyan")}${chipRow((bal?.ji || []).map((c) => c.soft || ""), "coral")}</div>
        ${bal?.yong_soft ? `<p class="pcm-cal__note" style="margin-top:8px">${escapeHtml(bal.yong_soft)}</p>` : ""}
      </div>
      <div class="pcm-card" style="margin-top:14px">
        <div class="pcm-label pcm-label--sand">${escapeHtml(zh ? "结构键与张力" : "Bonds & tensions")}</div>
        <div class="pcm-chips">${chipRow((display.fact_panel?.structure?.bonds || []).map((c) => c.soft || ""), "gold")}</div>
        <div class="pcm-chips" style="margin-top:8px">${chipRow((display.fact_panel?.structure?.tensions || []).map((c) => c.soft || ""), "coral")}</div>
      </div>
    </section>
  </div>
</section>`;
}

function payloadStrengthFallback(display: MatrixSynopsisDisplay, locale: string): string {
  const zh = normalizeMatrixLocale(locale) === "zh";
  return zh ? "力度读数已写入本次会话" : "Strength readout locked for this session";
}

function zodiacEmoji(han: string): string {
  const map: Record<string, string> = {
    鼠: "🐀", 牛: "🐂", 虎: "🐅", 兔: "🐇", 龙: "🐉", 蛇: "🐍",
    马: "🐎", 羊: "🐐", 猴: "🐒", 鸡: "🐓", 狗: "🐕", 猪: "🐖",
  };
  return map[han] || "✦";
}

function buildZodiacArt(display: MatrixSynopsisDisplay): string {
  // Prefer emoji glyph for fully offline tiny footprint; class matches live art box.
  const emoji = zodiacEmoji(display.zodiac.han);
  return `<span class="pcm-zodiac__emoji">${emoji}</span>`;
}

function leftFoot(zh: boolean): string {
  if (zh) {
    return `<p>点目录切换章节（B1–B5）。</p><p>本文件保存在你的设备上；打开无需登录。</p><p>内容供决策参考，不构成医疗、法律或投资建议。</p>`;
  }
  return `<p>Use the contents list to switch chapters (B1–B5).</p><p>This file stays on your device; no login required to open.</p><p>For decision reference only — not medical, legal, or investment advice.</p>`;
}

/**
 * Fill the blank baseline template from a matrix payload.
 * Output is a complete offline HTML document (same bytes for popup/download/email).
 */
export function buildBaselineProfileOfflineHtml(
  payload: PojuMatrixPayload,
  locale: string,
  options: BuildBaselineProfileOfflineHtmlOptions = {},
): string {
  const matrixLocale = normalizeMatrixLocale(locale);
  const zh = matrixLocale === "zh";
  const display = resolveMatrixDisplay(payload, locale);
  const title =
    options.title?.trim() ||
    tMatrix(locale, "main_title");
  const subtitle =
    options.subtitle?.trim() ||
    tMatrix(locale, "main_description");
  const bornLine = formatBornLine(payload, locale);
  const placeLine = formatPlaceLine(payload);
  const localeLabel = zh ? "中文" : locale.slice(0, 2).toUpperCase();
  const subject = options.subjectLabel?.trim() || payload.display_name || payload.matrix_id || "";
  const closeLabel = options.closeLabel?.trim() || (zh ? "关闭" : "Close");
  const zodiacArt = buildZodiacArt(display);

  const panes = [
    renderCalibrationPane(display, locale, subtitle, zodiacArt),
    renderEnergyPane(display, locale, subtitle, payload),
    renderTrajectoryPane(display, locale, subtitle),
    renderMarkersPane(display, locale, subtitle),
    renderCorePane(display, locale, subtitle),
  ].join("\n");

  return fillSlots(BASELINE_PROFILE_BLANK_TEMPLATE, {
    SLOT_LANG: zh ? "zh-Hans" : locale.slice(0, 2) || "en",
    SLOT_LOCALE_SHORT: zh ? "zh" : locale.slice(0, 2) || "en",
    SLOT_DOC_TITLE: escapeHtml(title),
    SLOT_TITLE: escapeHtml(title),
    SLOT_SUBTITLE: escapeHtml(subtitle),
    SLOT_EMBED: options.embed ? "1" : "0",
    SLOT_CLOSE_LABEL: escapeHtml(closeLabel),
    SLOT_META_CARD: buildMetaCard({ bornLine, placeLine, localeLabel, subject }),
    SLOT_TOC_ARIA: zh ? "目录" : "Contents",
    SLOT_TOC_HEAD: zh ? "目录" : "CONTENTS",
    SLOT_TOC_ITEMS: buildTocItems(locale, "calibration"),
    SLOT_LEFT_FOOT: leftFoot(zh),
    SLOT_PANES: panes,
    SLOT_FOOTER_ARIA: zh ? "书页" : "Pages",
    SLOT_PREV_LABEL: zh ? "上一页" : "Previous",
    SLOT_NEXT_LABEL: zh ? "下一页" : "Next",
  });
}

/** Public download / email filename. */
export function baselineProfileOfflineFilename(when: Date = new Date()): string {
  const d = when.toISOString().slice(0, 10);
  return `eastern-os-baseline-profile-${d}.html`;
}

/** Expose blank template for tests / smoke. */
export function getBaselineProfileBlankTemplate(): string {
  return BASELINE_PROFILE_BLANK_TEMPLATE;
}
