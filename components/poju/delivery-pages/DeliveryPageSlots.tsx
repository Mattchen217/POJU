/**
 * Slot UI for page_schema_v1 — same visual language as DeliveryBookStage modules.
 * Only block order / fields change; cards reuse section-head + section-card.
 */

"use client";

import type { ReactNode } from "react";
import { EvidenceBlock } from "@/components/cross-product/EvidenceBlock";
import { GlossaryText } from "@/components/cross-product/GlossaryText";
import type { Locale } from "@/lib/glossary/term-glossary";
import type {
  ActionAngle,
  Day7Item,
  DecisionTrack,
  DeliveryPageData,
  DimLevel,
  P1Page,
  RiskItem,
} from "@/lib/llm/pro/delivery/page-schema/types";
import {
  extractPageSchemaFromMarkdown,
  stripPageSchemaFence,
} from "@/lib/llm/pro/delivery/page-schema/render";
import { splitReadableParagraphs } from "@/lib/llm/pro/delivery/page-schema/prose-paragraphs";
import {
  coerceDay7Item,
  coerceRiskItem,
} from "@/lib/llm/pro/delivery/page-schema/sanitize";
import { remapP4DimensionNameForCompliance } from "@/lib/llm/pro/delivery/page-schema/p4-compliance-dim-names";
import { deliverySlotUiCopy } from "@/lib/llm/pro/delivery/delivery-slot-ui-copy";
import {
  composeDualEvidence,
  splitDualEvidence,
} from "@/lib/llm/pro/delivery/page-schema/dual-evidence";
import {
  EmptyFacePageSlots,
  FacePageSlots,
} from "@/components/poju/delivery-pages/faces/FacePageSlots";
import { isFaceNativePage } from "@/lib/llm/pro/delivery/page-schema/face-types";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { isDecisionFaceId } from "@/lib/llm/pro/delivery/page-schema/face-kicker";

/** Polish / partial JSON may drop Zod defaults — never throw on .map / .length. */
function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringList(value: unknown): string[] {
  return asList(value).map((x) =>
    typeof x === "string" ? x : x == null ? "" : String(x),
  );
}

function asObjectList<T extends object = Record<string, unknown>>(
  value: unknown,
): T[] {
  return asList(value).filter(
    (x): x is T => x != null && typeof x === "object" && !Array.isArray(x),
  );
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function optionFieldLabels(locale: string): {
  upside: string;
  cost: string;
  risk: string;
  reversible: string;
} {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) {
    return { upside: "收益", cost: "成本", risk: "风险", reversible: "可逆" };
  }
  return {
    upside: "Upside",
    cost: "Cost",
    risk: "Risk",
    reversible: "Reversible",
  };
}

function slotUiCopy(locale: string) {
  return deliverySlotUiCopy(locale);
}

function dualEvidenceSectionTitles(locale: string): { meta: string; sci: string } {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) return { meta: "命理依据", sci: "科学依据" };
  if (l.startsWith("es")) return { meta: "Base metafísica", sci: "Base científica" };
  if (l.startsWith("fr")) return { meta: "Fondement métaphysique", sci: "Fondement scientifique" };
  if (l.startsWith("de")) return { meta: "Metaphysische Basis", sci: "Wissenschaftliche Basis" };
  return { meta: "Metaphysics basis", sci: "Science basis" };
}

/** One module = existing book chrome (dot title + glass section-card). */
function SlotCard({
  title,
  gloss,
  children,
  evidence,
  evidenceLabel,
  locale,
  isLast,
}: {
  title?: string;
  gloss?: string;
  children: ReactNode;
  evidence?: string;
  evidenceLabel?: string;
  locale: string;
  isLast?: boolean;
}) {
  const ev = (evidence ?? "").trim();
  return (
    <article
      className={`delivery-book-stage__module${isLast ? " is-last" : ""}`}
    >
      {title ? (
        <header className="delivery-book-stage__section-head">
          <span className="delivery-book-stage__section-dot" aria-hidden />
          <div className="delivery-book-stage__section-head-text">
            <h2 className="delivery-book-stage__section-title">{title}</h2>
            {gloss ? <p className="delivery-book-stage__section-gloss">{gloss}</p> : null}
          </div>
        </header>
      ) : null}
      <div className="delivery-book-stage__section-card">
        <div className="delivery-book-stage__section-body poju-delivery-v2__body">
          <div className="poju-delivery-v2__prose">{children}</div>
        </div>
        {ev ? (
          <EvidenceBlock
            label={evidenceLabel}
            locale={locale}
            defaultOpen={false}
            toggleIcon="play"
            className="delivery-book-stage__evidence"
          >
            <div className="poju-delivery-v2__evidence-body">
              <DualEvidenceBody text={ev} locale={locale} />
            </div>
          </EvidenceBlock>
        ) : null}
      </div>
    </article>
  );
}

/** Folded evidence: fixed two subsections (命理 / 科学). Prefer structured fields. */
function DualEvidenceBody({
  text,
  locale,
  metaphysics,
  science,
}: {
  text?: string;
  locale: string;
  metaphysics?: string;
  science?: string;
}) {
  const structuredM = (metaphysics ?? "").trim();
  const structuredS = (science ?? "").trim();
  const dual =
    structuredM || structuredS
      ? composeDualEvidence(structuredM, structuredS)
      : splitDualEvidence(text);
  const titles = dualEvidenceSectionTitles(locale);
  const hasMeta = Boolean(dual.metaphysics_evidence);
  const hasSci = Boolean(dual.science_evidence);
  if (!hasMeta && !hasSci) {
    const fallback = (text ?? "").trim();
    if (!fallback) return null;
    return (
      <div className="poju-delivery-v2__prose">
        <GlossaryText text={fallback} locale={locale as Locale} layer="evidence" bracketSoft={false} />
      </div>
    );
  }
  return (
    <div className="poju-delivery-v2__prose dps-dual-evidence">
      {hasMeta ? (
        <section className="dps-dual-evidence__section">
          <h3 className="dps-dual-evidence__h">{titles.meta}</h3>
          <GlossaryText
            text={dual.metaphysics_evidence}
            locale={locale as Locale}
            layer="evidence"
            bracketSoft={false}
          />
        </section>
      ) : null}
      {hasSci ? (
        <section className="dps-dual-evidence__section">
          <h3 className="dps-dual-evidence__h">{titles.sci}</h3>
          <GlossaryText
            text={dual.science_evidence}
            locale={locale as Locale}
            layer="evidence"
            bracketSoft={false}
          />
        </section>
      ) : null}
    </div>
  );
}

function Gloss({ text, locale }: { text: unknown; locale: string }) {
  const safe =
    typeof text === "string"
      ? text
      : text == null || typeof text === "object"
        ? ""
        : String(text);
  // Dual-layer: body = zero gold (legacy autoMark was turning 纪元/岁环 into gold chips).
  return <GlossaryText text={safe} locale={locale as Locale} layer="body" />;
}

function RiskItemBlock({
  item,
  copy,
  locale,
  evidence,
  evidenceLabel,
}: {
  item: RiskItem | string | unknown;
  copy: ReturnType<typeof slotUiCopy>;
  locale: string;
  /** Per-RiskItem evidence (1:1 with ClaimPlan / render order). */
  evidence?: string;
  evidenceLabel?: string;
}) {
  const row = coerceRiskItem(item, 200);
  if (!row) return null;
  const ev = (evidence ?? "").trim();
  // Prefer model-written narrative — never stitch the four beats in code.
  const body = row.narrative?.trim() ? (
    <div className="dps-risk-item dps-risk-item--narrative">
      <ProseStack text={row.narrative} locale={locale} />
    </div>
  ) : (
    <div className="dps-risk-item">
      <div className="dps-risk-row">
        <span className="dps-risk-label">{copy.riskSit}</span>
        <span className="dps-risk-copy">
          <Gloss text={row.situation} locale={locale} />
        </span>
      </div>
      <div className="dps-risk-row">
        <span className="dps-risk-label">{copy.riskDo}</span>
        <span className="dps-risk-copy">
          <Gloss text={row.then_do} locale={locale} />
        </span>
      </div>
      <div className="dps-risk-row">
        <span className="dps-risk-label">{copy.riskWatch}</span>
        <span className="dps-risk-copy">
          <Gloss text={row.watch} locale={locale} />
        </span>
      </div>
      <div className="dps-risk-row">
        <span className="dps-risk-label dps-risk-label--forbid">{copy.riskForbid}</span>
        <span className="dps-risk-copy">
          <Gloss text={row.forbid} locale={locale} />
        </span>
      </div>
    </div>
  );
  return (
    <div className="dps-risk-item-wrap">
      {body}
      {ev ? (
        <EvidenceBlock
          label={evidenceLabel}
          locale={locale}
          defaultOpen={false}
          toggleIcon="play"
          className="delivery-book-stage__evidence dps-risk-item__evidence"
        >
          <div className="poju-delivery-v2__evidence-body">
            <DualEvidenceBody text={ev} locale={locale} />
          </div>
        </EvidenceBlock>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="delivery-book-stage__rx-part">
      <div className="delivery-book-stage__rx-label">{label}</div>
      <div className="delivery-book-stage__section-body poju-delivery-v2__body">
        <div className="poju-delivery-v2__prose">{children}</div>
      </div>
    </div>
  );
}

function AngleBody({
  angle,
  copy,
  locale,
}: {
  angle: ActionAngle | null | undefined;
  copy: ReturnType<typeof slotUiCopy>;
  locale: string;
}) {
  const means = asStringList(angle?.means);
  const hardMetrics = asStringList(angle?.hard_metrics);
  return (
    <div className="delivery-book-stage__rx-parts">
      <Field label={copy.strategy}>
        <div className="dps-prose-stack">
          {splitReadableParagraphs(angle?.strategy).map((p, i) => (
            <p key={`${i}-${p.slice(0, 20)}`}>
              <Gloss text={p} locale={locale} />
            </p>
          ))}
        </div>
      </Field>
      <Field label={copy.means}>
        <ol className="dps-step-list">
          {means.map((s, i) => (
            <li key={`${i}-${s.slice(0, 24)}`} className="dps-step-item">
              <span className="dps-step-num" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="dps-step-copy">
                <Gloss text={s} locale={locale} />
              </span>
            </li>
          ))}
        </ol>
      </Field>
      {hardMetrics.length > 0 ? (
        <Field label={copy.metrics}>
          <ul className="dps-metrics-list">
            {hardMetrics.map((m) => (
              <li key={m}>
                <Gloss text={m} locale={locale} />
              </li>
            ))}
          </ul>
        </Field>
      ) : null}
    </div>
  );
}

function TrackSectionHead({
  title,
  gloss,
}: {
  title: string;
  gloss: string;
}) {
  return (
    <header className="delivery-book-stage__section-head dps-track-head">
      <span className="delivery-book-stage__section-dot" aria-hidden />
      <div className="delivery-book-stage__section-head-text">
        <h2 className="delivery-book-stage__section-title">{title}</h2>
        <p className="delivery-book-stage__section-gloss">{gloss}</p>
      </div>
    </header>
  );
}

function ChipRows({
  items,
  mark,
  tone,
  locale,
}: {
  items: string[];
  mark: string;
  tone: "leverage" | "avoid";
  locale: string;
}) {
  return (
    <ul className={`dps-chip-list dps-chip-list--${tone}`}>
      {items.map((x) => (
        <li key={x} className="dps-chip-row">
          <span className="dps-chip-mark" aria-hidden>
            {mark}
          </span>
          <span className="dps-chip-copy">
            <Gloss text={x} locale={locale} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function IdentityRow({
  label,
  text,
  locale,
}: {
  label: string;
  text: string;
  locale: string;
}) {
  return (
    <div className="dps-identity-row">
      <span className="dps-identity-label">{label}</span>
      <span className="dps-identity-copy">
        <Gloss text={text} locale={locale} />
      </span>
    </div>
  );
}

function TonightMetaRow({
  label,
  text,
  locale,
}: {
  label: string;
  text: string;
  locale: string;
}) {
  if (!text.trim()) return null;
  return (
    <div className="dps-tonight-row">
      <span className="dps-tonight-label">{label}</span>
      <span className="dps-tonight-copy">
        <Gloss text={text} locale={locale} />
      </span>
    </div>
  );
}

function Day7Card({
  item,
  index,
  copy,
  locale,
}: {
  item: Day7Item;
  index: number;
  copy: ReturnType<typeof slotUiCopy>;
  locale: string;
}) {
  return (
    <li className="dps-check-item dps-check-item--card">
      <span className="dps-check-num" aria-hidden>
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="dps-check-box" aria-hidden />
      <div className="dps-check-body">
        <p className="dps-check-action">
          <Gloss text={item.action} locale={locale} />
        </p>
        {item.why.trim() ? (
          <p className="dps-check-meta">
            <span className="dps-check-meta-label">{copy.day7WhyLabel}</span>
            <Gloss text={item.why} locale={locale} />
          </p>
        ) : null}
        {item.done_when.trim() ? (
          <p className="dps-check-meta">
            <span className="dps-check-meta-label">{copy.day7DoneLabel}</span>
            <Gloss text={item.done_when} locale={locale} />
          </p>
        ) : null}
      </div>
    </li>
  );
}

function ProseStack({ text, locale }: { text: string; locale: string }) {
  return (
    <div className="dps-prose-stack">
      {splitReadableParagraphs(text).map((p, i) => (
        <p key={`${i}-${p.slice(0, 20)}`}>
          <Gloss text={p} locale={locale} />
        </p>
      ))}
    </div>
  );
}

function dimFill(level: DimLevel): number {
  if (level === "high") return 3;
  if (level === "mid") return 2;
  if (level === "low") return 1;
  return 0;
}

function DimBars({
  dims,
  copy,
}: {
  dims: DecisionTrack["dims"];
  copy: ReturnType<typeof slotUiCopy>;
}) {
  const items: Array<{ key: string; level: DimLevel; label: string; text: string }> = [
    { key: "body", level: dims.body, label: copy.body, text: copy.dimBody[dims.body] },
    { key: "mind", level: dims.mind, label: copy.mind, text: copy.dimMind[dims.mind] },
    { key: "field", level: dims.field, label: copy.field, text: copy.dimField[dims.field] },
  ];
  return (
    <div className="dps-p1-bars" role="group" aria-label={copy.dims}>
      <p className="dps-p1-bars__hint">{copy.dimsHint}</p>
      <ul className="dps-p1-bars__list">
        {items.map((it) => {
          const fill = dimFill(it.level);
          return (
            <li key={it.key} className={`dps-p1-bar dps-p1-bar--${it.level}`}>
              <span className="dps-p1-bar__label">{it.label}</span>
              <span
                className="dps-p1-bar__track"
                aria-label={`${it.label}: ${it.text}`}
              >
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={`dps-p1-bar__seg${n <= fill ? " is-on" : ""}`}
                    aria-hidden
                  />
                ))}
              </span>
              <span className="dps-p1-bar__text">{it.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function P1ComparePair({
  page,
  copy,
  locale,
}: {
  page: P1Page;
  copy: ReturnType<typeof slotUiCopy>;
  locale: string;
}) {
  const goal = (t: DecisionTrack) => t.strategic_goal?.trim() || t.why;
  const cards: Array<{
    track: DecisionTrack;
    tone: "primary" | "backup";
    badge: string;
    roleLabel: string;
  }> = [
    {
      track: page.primary,
      tone: "primary",
      badge: copy.primaryBadge,
      roleLabel: copy.primary,
    },
    {
      track: page.backup,
      tone: "backup",
      badge: copy.backupBadge,
      roleLabel: copy.backup,
    },
  ];
  return (
    <article className="delivery-book-stage__module dps-p1-compare-wrap">
      <header className="delivery-book-stage__section-head">
        <span className="delivery-book-stage__section-dot" aria-hidden />
        <h2 className="delivery-book-stage__section-title">{copy.matrixTitle}</h2>
      </header>
      <div className="dps-p1-compare">
        {cards.map((c) => (
          <div
            key={c.tone}
            className={`delivery-book-stage__section-card dps-p1-compare__card dps-p1-compare__card--${c.tone}`}
          >
            <div className={`dps-p1-compare__badge dps-p1-compare__badge--${c.tone}`}>
              {c.roleLabel}
            </div>
            <h3 className={`dps-p1-compare__name dps-p1-compare__name--${c.tone}`}>
              {c.track.name}
            </h3>
            <p className="dps-p1-compare__badge-line">{c.badge}</p>
            <dl className="dps-p1-compare__dl">
              <div className="dps-p1-compare__row">
                <dt>{copy.matrixGoal}</dt>
                <dd>
                  <Gloss text={goal(c.track)} locale={locale} />
                </dd>
              </div>
              <div className="dps-p1-compare__row">
                <dt>{copy.matrixBody}</dt>
                <dd className="dps-p1-compare__meter">
                  <span
                    className="dps-p1-bar__track dps-p1-bar__track--inline"
                    aria-hidden
                  >
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={`dps-p1-bar__seg dps-p1-bar__seg--${c.tone}${
                          n <= dimFill(c.track.dims.body) ? " is-on" : ""
                        }`}
                      />
                    ))}
                  </span>
                  <span>{copy.dimBody[c.track.dims.body]}</span>
                </dd>
              </div>
              <div className="dps-p1-compare__row">
                <dt>{copy.matrixRisk}</dt>
                <dd>{copy.riskLabel[c.track.dims.field]}</dd>
              </div>
              <div className="dps-p1-compare__row">
                <dt>{copy.matrixWhen}</dt>
                <dd>
                  <Gloss text={c.track.when} locale={locale} />
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </article>
  );
}

function P1TrackCard({
  track,
  locale,
  copy,
  isLast,
}: {
  track: DecisionTrack;
  locale: string;
  copy: ReturnType<typeof slotUiCopy>;
  isLast?: boolean;
}) {
  const primary = track.role === "primary";
  return (
    <article
      className={`delivery-book-stage__module dps-p1-track${
        primary ? " dps-p1-track--primary" : " dps-p1-track--backup"
      }${isLast ? " is-last" : ""}`}
    >
      <header className="delivery-book-stage__section-head">
        <span className="delivery-book-stage__section-dot" aria-hidden />
        <h2 className="delivery-book-stage__section-title">
          {primary ? copy.primary : copy.backup} · {track.name}
        </h2>
      </header>
      <div
        className={`delivery-book-stage__section-card dps-p1-track__card${
          primary ? " dps-p1-track__card--primary" : " dps-p1-track__card--backup"
        }`}
      >
        <div
          className={`dps-p1-track__badge${
            primary ? " dps-p1-track__badge--primary" : " dps-p1-track__badge--backup"
          }`}
        >
          <span className="material-symbols-outlined" aria-hidden>
            {primary ? "star" : "shield"}
          </span>
          {primary ? copy.primaryBadge : copy.backupBadge}
        </div>
        <div className="delivery-book-stage__section-body poju-delivery-v2__body">
          <div className="poju-delivery-v2__prose">
            <div className="delivery-book-stage__rx-parts dps-p1-track__parts">
              <Field label={copy.coreLogic}>
                <div className="dps-p1-core-logic">
                  {splitReadableParagraphs(track.core_logic).map((p, i) => (
                    <p key={`${i}-${p.slice(0, 20)}`}>
                      <Gloss text={p} locale={locale} />
                    </p>
                  ))}
                </div>
              </Field>
              {track.leverage_chip?.trim() ? (
                <Field label={copy.chip}>
                  <p className="dps-p1-chip-inline">
                    <span className="material-symbols-outlined" aria-hidden>
                      key
                    </span>
                    <Gloss text={track.leverage_chip} locale={locale} />
                  </p>
                </Field>
              ) : null}
              <Field label={primary ? copy.when : copy.whenBackup}>
                <p>
                  <Gloss text={track.when} locale={locale} />
                </p>
              </Field>
              <Field label={copy.dims}>
                <DimBars dims={track.dims} copy={copy} />
              </Field>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function P1PageSlots({
  page,
  locale,
  copy,
}: {
  page: P1Page;
  locale: string;
  copy: ReturnType<typeof slotUiCopy>;
}) {
  return (
    <div className="delivery-book-stage__modules dps-page dps-page--p1">
      <article className="delivery-book-stage__module dps-p1-verdict">
        <header className="delivery-book-stage__section-head">
          <span className="delivery-book-stage__section-dot" aria-hidden />
          <h2 className="delivery-book-stage__section-title">{copy.coreJudgment}</h2>
        </header>
        <div className="delivery-book-stage__section-card dps-p1-verdict__card">
          <p className="dps-p1-verdict__text">
            <Gloss text={page.core_judgment} locale={locale} />
          </p>
        </div>
      </article>

      <P1ComparePair page={page} copy={copy} locale={locale} />

      <P1TrackCard track={page.primary} locale={locale} copy={copy} />
      <P1TrackCard track={page.backup} locale={locale} copy={copy} isLast />
    </div>
  );
}

function evAt(slotEvidence: string[] | undefined, index: number): string {
  return (slotEvidence?.[index] ?? "").trim();
}

function PageSlotsInner({
  page,
  locale,
  slotEvidence,
}: {
  page: DeliveryPageData;
  locale: string;
  slotEvidence?: string[];
}) {
  const copy = slotUiCopy(locale);

  switch (page.page) {
    case "decision_brief":
      return (
        <P1PageSlots
          page={page}
          locale={locale}
          copy={copy}
        />
      );
    case "situation_analysis":
    case "personal_decision_patterns":
    case "bottleneck_analysis": {
      let idx = 0;
      const sit =
        page.page === "situation_analysis" ? page : null;
      const facts = sit?.confirmed_facts?.filter(Boolean) ?? [];
      const assumptions = sit?.open_assumptions?.filter(Boolean) ?? [];
      const gaps = sit?.info_gaps?.filter(Boolean) ?? [];
      const hasLayers = facts.length + assumptions.length + gaps.length > 0;
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p2">
          <p className="dps-p2-bridge-note">{copy.bridgeNote}</p>
          {hasLayers ? (
            <SlotCard title={locale.startsWith("zh") ? "事实 · 假设 · 缺口" : "Facts · assumptions · gaps"} locale={locale}>
              <div className="delivery-book-stage__rx-parts">
                {facts.length ? (
                  <Field label={locale.startsWith("zh") ? "已确认事实" : "Confirmed facts"}>
                    <ul>{facts.map((f) => <li key={f}><Gloss text={f} locale={locale} /></li>)}</ul>
                  </Field>
                ) : null}
                {assumptions.length ? (
                  <Field label={locale.startsWith("zh") ? "待验证假设" : "Open assumptions"}>
                    <ul>{assumptions.map((f) => <li key={f}><Gloss text={f} locale={locale} /></li>)}</ul>
                  </Field>
                ) : null}
                {gaps.length ? (
                  <Field label={locale.startsWith("zh") ? "信息缺口" : "Info gaps"}>
                    <ul>{gaps.map((f) => <li key={f}><Gloss text={f} locale={locale} /></li>)}</ul>
                  </Field>
                ) : null}
              </div>
            </SlotCard>
          ) : null}
          {asObjectList<{ title?: string; surface?: string; essence?: string }>(
            page.why_cards,
          ).map((c, i, cards) => {
            const evidence = evAt(slotEvidence, idx++);
            const cardTitle = asText(c.title);
            return (
              <SlotCard
                key={cardTitle || `why-${i}`}
                title={cardTitle}
                locale={locale}
                evidence={evidence}
                evidenceLabel={copy.evidenceFor(cardTitle)}
                isLast={i === cards.length - 1}
              >
                <div className="delivery-book-stage__rx-parts">
                  <Field label={copy.surface}>
                    <p>
                      <Gloss text={asText(c.surface)} locale={locale} />
                    </p>
                  </Field>
                  <Field label={copy.essence}>
                    <p>
                      <Gloss text={asText(c.essence)} locale={locale} />
                    </p>
                  </Field>
                </div>
              </SlotCard>
            );
          })}
        </div>
      );
    }
    case "strategic_options": {
      const options = asObjectList<{
        name?: string;
        summary?: string;
        upside?: string;
        cost?: string;
        risk?: string;
        reversibility?: string;
      }>(page.options);
      const labels = optionFieldLabels(locale);
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--options">
          {options.map((opt, i) => {
            const name = asText(opt.name);
            return (
              <SlotCard
                key={name || `opt-${i}`}
                title={name}
                locale={locale}
                evidence={evAt(slotEvidence, i)}
                evidenceLabel={copy.evidenceFor(name)}
                isLast={i === options.length - 1}
              >
                <div className="delivery-book-stage__rx-parts">
                  <p>
                    <Gloss text={asText(opt.summary)} locale={locale} />
                  </p>
                  <Field label={labels.upside}>
                    <p>
                      <Gloss text={asText(opt.upside)} locale={locale} />
                    </p>
                  </Field>
                  <Field label={labels.cost}>
                    <p>
                      <Gloss text={asText(opt.cost)} locale={locale} />
                    </p>
                  </Field>
                  <Field label={labels.risk}>
                    <p>
                      <Gloss text={asText(opt.risk)} locale={locale} />
                    </p>
                  </Field>
                  <Field label={labels.reversible}>
                    <p>
                      <Gloss text={asText(opt.reversibility)} locale={locale} />
                    </p>
                  </Field>
                </div>
              </SlotCard>
            );
          })}
        </div>
      );
    }
    case "recommended_strategy": {
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--strategy">
          <SlotCard
            title={copy.coreJudgment}
            locale={locale}
            evidence={evAt(slotEvidence, 0)}
            evidenceLabel={copy.evidenceFor(copy.coreJudgment)}
          >
            <p>
              <Gloss text={page.core_judgment} locale={locale} />
            </p>
          </SlotCard>
          <SlotCard
            title={page.primary.name}
            locale={locale}
            evidence={evAt(slotEvidence, 1)}
            evidenceLabel={copy.evidenceFor(page.primary.name)}
          >
            <p>
              <Gloss text={page.primary.why} locale={locale} />
            </p>
            {page.primary.when ? (
              <p>
                <Gloss text={page.primary.when} locale={locale} />
              </p>
            ) : null}
            {page.primary.exit ? (
              <p>
                <Gloss text={page.primary.exit} locale={locale} />
              </p>
            ) : null}
          </SlotCard>
          <SlotCard
            title={page.backup.name}
            locale={locale}
            evidence={evAt(slotEvidence, 2)}
            evidenceLabel={copy.evidenceFor(page.backup.name)}
            isLast
          >
            <p>
              <Gloss text={page.backup.why} locale={locale} />
            </p>
            {page.backup.when ? (
              <p>
                <Gloss text={page.backup.when} locale={locale} />
              </p>
            ) : null}
            {page.backup.exit ? (
              <p>
                <Gloss text={page.backup.exit} locale={locale} />
              </p>
            ) : null}
          </SlotCard>
        </div>
      );
    }
    case "execution_guidance": {
      let idx = 0;
      const openingEv = page.opening?.trim() ? evAt(slotEvidence, idx++) : "";
      const primaryToolkit =
        page.primary_toolkit && typeof page.primary_toolkit === "object"
          ? page.primary_toolkit
          : null;
      const backupToolkit =
        page.backup_toolkit && typeof page.backup_toolkit === "object"
          ? page.backup_toolkit
          : null;
      const primaryTitle = asText(primaryToolkit?.title);
      const backupTitle = asText(backupToolkit?.title);
      const primaryAngles = asObjectList<ActionAngle>(primaryToolkit?.angles);
      const backupAngles = asObjectList<ActionAngle>(backupToolkit?.angles);
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p3">
          {page.opening ? (
            <SlotCard
              locale={locale}
              evidence={openingEv}
              evidenceLabel={copy.evidenceFor(copy.coreJudgment)}
            >
              <ProseStack text={page.opening} locale={locale} />
            </SlotCard>
          ) : null}
          <TrackSectionHead
            title={`${copy.primary} · ${primaryTitle}`}
            gloss={copy.primaryTrackGloss}
          />
          {primaryAngles.map((a, i) => {
            const evidence = evAt(slotEvidence, idx++);
            const angleName = asText(a?.name);
            return (
              <SlotCard
                key={`p-${angleName}-${i}`}
                title={`${copy.angle} · ${angleName}`}
                gloss={copy.angleGloss}
                locale={locale}
                evidence={evidence}
                evidenceLabel={copy.evidenceFor(angleName)}
              >
                <AngleBody angle={a} copy={copy} locale={locale} />
              </SlotCard>
            );
          })}
          <TrackSectionHead
            title={`${copy.backup} · ${backupTitle}`}
            gloss={copy.backupTrackGloss}
          />
          {backupAngles.map((a, i) => {
            const evidence = evAt(slotEvidence, idx++);
            const isLastAngle = i === backupAngles.length - 1;
            const angleName = asText(a?.name);
            return (
              <SlotCard
                key={`b-${angleName}-${i}`}
                title={`${copy.angle} · ${angleName}`}
                gloss={copy.angleGloss}
                locale={locale}
                evidence={evidence}
                evidenceLabel={copy.evidenceFor(angleName)}
                isLast={isLastAngle}
              >
                <AngleBody angle={a} copy={copy} locale={locale} />
              </SlotCard>
            );
          })}
        </div>
      );
    }
    case "self_regulation": {
      let idx = 0;
      const dimensions = asObjectList<ActionAngle>(page.dimensions);
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p4">
          {dimensions.map((a, i) => {
            const evidence = evAt(slotEvidence, idx++);
            const isLast = i === dimensions.length - 1;
            const dimName = remapP4DimensionNameForCompliance(asText(a?.name));
            return (
              <SlotCard
                key={`d-${dimName}-${i}`}
                title={`${copy.dimension} · ${dimName}`}
                gloss={copy.dimensionGloss}
                locale={locale}
                evidence={evidence}
                evidenceLabel={copy.evidenceWhy(dimName)}
                isLast={isLast}
              >
                <AngleBody angle={a} copy={copy} locale={locale} />
              </SlotCard>
            );
          })}
        </div>
      );
    }
    case "thirty_day": {
      const weeks = asObjectList<{
        week?: number;
        focus?: string;
        actions?: unknown;
      }>(page.weeks);
      const day7Checklist = asStringList(page.day7_checklist);
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p5">
          {weeks.map((w, wi) => {
            const weekNum = typeof w.week === "number" ? w.week : wi + 1;
            const actions = asStringList(w.actions);
            return (
              <SlotCard
                key={weekNum}
                title={`${copy.week(weekNum)} · ${asText(w.focus)}`}
                locale={locale}
                evidence={evAt(slotEvidence, wi)}
                evidenceLabel={copy.evidenceFor(copy.week(weekNum))}
              >
                <ul className="dps-list">
                  {actions.map((a) => (
                    <li key={a}>
                      <Gloss text={a} locale={locale} />
                    </li>
                  ))}
                </ul>
              </SlotCard>
            );
          })}
          <SlotCard
            title={copy.day7}
            locale={locale}
            evidence={evAt(slotEvidence, 4)}
            evidenceLabel={copy.evidenceFor(copy.day7)}
            isLast
          >
            <ul className="dps-list">
              {day7Checklist.map((x) => (
                <li key={x}>
                  <Gloss text={x} locale={locale} />
                </li>
              ))}
            </ul>
          </SlotCard>
        </div>
      );
    }
    case "validation_risk": {
      /** Evidence order matches pageSchemaToArgumentBodies: red… · traps… · switch · protection… */
      let riskEvIdx = 0;
      const nextRiskEv = () => evAt(slotEvidence, riskEvIdx++);
      const redLights = asList(page.red_lights);
      const traps = asList(page.traps);
      const protectionRules = asList(page.protection_rules);
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p6">
          <SlotCard
            title={copy.redLights}
            gloss={copy.redLightsGloss}
            locale={locale}
          >
            <div className="dps-risk-stack">
              {redLights.map((x, i) => (
                <RiskItemBlock
                  key={
                    typeof x === "object" && x && "situation" in x
                      ? String((x as RiskItem).situation)
                      : `red-${i}`
                  }
                  item={x}
                  copy={copy}
                  locale={locale}
                  evidence={nextRiskEv()}
                  evidenceLabel={copy.evidenceFor(`${copy.redLights} ${i + 1}`)}
                />
              ))}
            </div>
          </SlotCard>
          <SlotCard
            title={copy.traps}
            gloss={copy.trapsGloss}
            locale={locale}
          >
            <div className="dps-risk-stack">
              {traps.map((x, i) => (
                <RiskItemBlock
                  key={
                    typeof x === "object" && x && "situation" in x
                      ? String((x as RiskItem).situation)
                      : `trap-${i}`
                  }
                  item={x}
                  copy={copy}
                  locale={locale}
                  evidence={nextRiskEv()}
                  evidenceLabel={copy.evidenceFor(`${copy.traps} ${i + 1}`)}
                />
              ))}
            </div>
          </SlotCard>
          <SlotCard
            title={copy.switchBackup}
            gloss={copy.switchBackupGloss}
            locale={locale}
          >
            <RiskItemBlock
              item={page.switch_to_backup}
              copy={copy}
              locale={locale}
              evidence={nextRiskEv()}
              evidenceLabel={copy.evidenceFor(copy.switchBackup)}
            />
          </SlotCard>
          <SlotCard
            title={copy.protection}
            gloss={copy.protectionGloss}
            locale={locale}
            isLast
          >
            <div className="dps-risk-stack">
              {protectionRules.map((x, i) => (
                <RiskItemBlock
                  key={
                    typeof x === "object" && x && "situation" in x
                      ? String((x as RiskItem).situation)
                      : `protect-${i}`
                  }
                  item={x}
                  copy={copy}
                  locale={locale}
                  evidence={nextRiskEv()}
                  evidenceLabel={copy.evidenceFor(`${copy.protection} ${i + 1}`)}
                />
              ))}
            </div>
          </SlotCard>
        </div>
      );
    }
    case "validation_close": {
      const day7Rows = asList(page.day7_micro_actions)
        .map((x) => coerceDay7Item(x))
        .filter((x): x is Day7Item => Boolean(x));
      const watchSignals = (
        Array.isArray(page.watch_signals) ? page.watch_signals : []
      )
        .map((t) => String(t ?? "").trim())
        .filter(Boolean)
        .slice(0, 5);
      const takeaways =
        Array.isArray(page.takeaways) && page.takeaways.length >= 3
          ? page.takeaways.slice(0, 3)
          : [];
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p7">
          <SlotCard
            title={`${copy.before} → ${copy.after}`}
            gloss={copy.identityGloss}
            locale={locale}
            evidence={evAt(slotEvidence, 0)}
            evidenceLabel={copy.evidenceFor(copy.before)}
          >
            <div className="dps-identity-stack">
              <IdentityRow
                label={copy.before}
                text={page.identity_before}
                locale={locale}
              />
              <IdentityRow
                label={copy.after}
                text={page.identity_after}
                locale={locale}
              />
              {page.identity_shift?.trim() ? (
                <div className="dps-identity-shift">
                  <p className="dps-identity-shift-label">{copy.identityShiftLabel}</p>
                  <ProseStack text={page.identity_shift} locale={locale} />
                </div>
              ) : null}
            </div>
          </SlotCard>
          <SlotCard
            title={copy.quoteTitle}
            gloss={copy.quoteGloss}
            locale={locale}
          >
            <blockquote className="dps-quote-plain">
              <Gloss text={page.quote} locale={locale} />
            </blockquote>
            {page.quote_use?.trim() ? (
              <p className="dps-quote-use">
                <span className="dps-quote-use-label">{copy.quoteUseLabel}</span>
                <Gloss text={page.quote_use} locale={locale} />
              </p>
            ) : null}
          </SlotCard>
          {watchSignals.length > 0 ? (
            <SlotCard
              title={copy.watchSignals}
              gloss={copy.watchSignalsGloss}
              locale={locale}
            >
              <ol className="dps-seal-list dps-watch-list">
                {watchSignals.map((t, i) => (
                  <li key={`${i}-${t.slice(0, 20)}`} className="dps-seal-item">
                    <span className="dps-seal-num" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="dps-seal-copy">
                      <Gloss text={t} locale={locale} />
                    </span>
                  </li>
                ))}
              </ol>
            </SlotCard>
          ) : null}
          <SlotCard
            title={copy.tonight}
            gloss={copy.tonightGloss}
            locale={locale}
            evidence={evAt(slotEvidence, 2)}
            evidenceLabel={copy.evidenceFor(copy.tonight)}
          >
            <div className="dps-tonight-stack">
              <p className="dps-tonight-action">
                <Gloss text={page.immediate_action} locale={locale} />
              </p>
              <TonightMetaRow
                label={copy.tonightDoneLabel}
                text={page.tonight_done_looks_like ?? ""}
                locale={locale}
              />
              <TonightMetaRow
                label={copy.tonightWhyLabel}
                text={page.tonight_why ?? ""}
                locale={locale}
              />
            </div>
          </SlotCard>
          <SlotCard
            title={copy.day7}
            gloss={copy.day7Gloss}
            locale={locale}
            evidence={evAt(slotEvidence, 3)}
            evidenceLabel={copy.evidenceFor(copy.day7)}
            isLast={takeaways.length === 0}
          >
            <ol className="dps-check-list">
              {day7Rows.map((row, i) => (
                <Day7Card
                  key={`${i}-${row.action.slice(0, 24)}`}
                  item={row}
                  index={i}
                  copy={copy}
                  locale={locale}
                />
              ))}
            </ol>
          </SlotCard>
          {takeaways.length > 0 ? (
            <SlotCard
              title={copy.takeaways}
              gloss={copy.takeawaysGloss}
              locale={locale}
              isLast
            >
              <ol className="dps-seal-list">
                {takeaways.map((t, i) => (
                  <li key={`${i}-${String(t).slice(0, 20)}`} className="dps-seal-item">
                    <span className="dps-seal-num" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="dps-seal-copy">
                      <Gloss text={String(t)} locale={locale} />
                    </span>
                  </li>
                ))}
              </ol>
            </SlotCard>
          ) : null}
        </div>
      );
    }
    default:
      return null;
  }
}

export function DeliveryPageSlots({
  markdown,
  locale,
  pageSchema,
  slotEvidence,
  shelfFaceId,
}: {
  markdown: string;
  locale: string;
  pageSchema?: DeliveryPageData | null;
  slotEvidence?: string[];
  /** Shelf slot 01–08 — preferred dispatch for face-native books. */
  shelfFaceId?: string | null;
}) {
  const page = pageSchema ?? extractPageSchemaFromMarkdown(markdown);
  if (page && isFaceNativePage(page)) {
    return (
      <FacePageSlots
        page={page}
        locale={locale}
        faceId={
          isDecisionFaceId(shelfFaceId ?? "")
            ? (shelfFaceId as DecisionPageId)
            : undefined
        }
      />
    );
  }
  // Legacy v1 papers on an old book — degrade; new books must not hit this path.
  if (
    shelfFaceId &&
    isDecisionFaceId(shelfFaceId) &&
    (!page || !isFaceNativePage(page))
  ) {
    // If JSON is missing but we know the face, still show new section chrome.
    if (!page) {
      return <EmptyFacePageSlots faceId={shelfFaceId} locale={locale} />;
    }
  }
  if (!page) return null;
  return (
    <PageSlotsInner page={page} locale={locale} slotEvidence={slotEvidence} />
  );
}

export function deliveryMarkdownWithoutSchemaFence(markdown: string): string {
  return stripPageSchemaFence(markdown);
}
