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

function slotUiCopy(locale: string) {
  return deliverySlotUiCopy(locale);
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
              <div className="poju-delivery-v2__prose">
                <GlossaryText
                  text={ev}
                  locale={locale as Locale}
                  layer="evidence"
                  bracketSoft={false}
                />
              </div>
            </div>
          </EvidenceBlock>
        ) : null}
      </div>
    </article>
  );
}

function Gloss({ text, locale }: { text: unknown; locale: string }) {
  const safe =
    typeof text === "string"
      ? text
      : text == null || typeof text === "object"
        ? ""
        : String(text);
  return <GlossaryText text={safe} locale={locale as Locale} />;
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
          <GlossaryText text={ev} locale={locale as Locale} />
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
  angle: ActionAngle;
  copy: ReturnType<typeof slotUiCopy>;
  locale: string;
}) {
  return (
    <div className="delivery-book-stage__rx-parts">
      <Field label={copy.strategy}>
        <div className="dps-prose-stack">
          {splitReadableParagraphs(angle.strategy).map((p, i) => (
            <p key={`${i}-${p.slice(0, 20)}`}>
              <Gloss text={p} locale={locale} />
            </p>
          ))}
        </div>
      </Field>
      <Field label={copy.means}>
        <ol className="dps-step-list">
          {angle.means.map((s, i) => (
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
      {angle.hard_metrics.length > 0 ? (
        <Field label={copy.metrics}>
          <ul className="dps-metrics-list">
            {angle.hard_metrics.map((m) => (
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
    case "direct_answer":
      return (
        <P1PageSlots
          page={page}
          locale={locale}
          copy={copy}
        />
      );
    case "foundation": {
      let idx = 0;
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p2">
          <p className="dps-p2-bridge-note">{copy.bridgeNote}</p>
          {page.why_cards.map((c, i) => {
            const evidence = evAt(slotEvidence, idx++);
            return (
              <SlotCard
                key={c.title}
                title={c.title}
                locale={locale}
                evidence={evidence}
                evidenceLabel={copy.evidenceFor(c.title)}
                isLast={i === page.why_cards.length - 1}
              >
                <div className="delivery-book-stage__rx-parts">
                  <Field label={copy.surface}>
                    <p>
                      <Gloss text={c.surface} locale={locale} />
                    </p>
                  </Field>
                  <Field label={copy.essence}>
                    <p>
                      <Gloss text={c.essence} locale={locale} />
                    </p>
                  </Field>
                </div>
              </SlotCard>
            );
          })}
        </div>
      );
    }
    case "science_action": {
      let idx = 0;
      const openingEv = page.opening?.trim() ? evAt(slotEvidence, idx++) : "";
      const primaryAngles = page.primary_toolkit.angles;
      const backupAngles = page.backup_toolkit.angles;
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
            title={`${copy.primary} · ${page.primary_toolkit.title}`}
            gloss={copy.primaryTrackGloss}
          />
          {primaryAngles.map((a, i) => {
            const evidence = evAt(slotEvidence, idx++);
            return (
              <SlotCard
                key={`p-${a.name}-${i}`}
                title={`${copy.angle} · ${a.name}`}
                gloss={copy.angleGloss}
                locale={locale}
                evidence={evidence}
                evidenceLabel={copy.evidenceFor(a.name)}
              >
                <AngleBody angle={a} copy={copy} locale={locale} />
              </SlotCard>
            );
          })}
          <TrackSectionHead
            title={`${copy.backup} · ${page.backup_toolkit.title}`}
            gloss={copy.backupTrackGloss}
          />
          {backupAngles.map((a, i) => {
            const evidence = evAt(slotEvidence, idx++);
            const isLastAngle = i === backupAngles.length - 1;
            return (
              <SlotCard
                key={`b-${a.name}-${i}`}
                title={`${copy.angle} · ${a.name}`}
                gloss={copy.angleGloss}
                locale={locale}
                evidence={evidence}
                evidenceLabel={copy.evidenceFor(a.name)}
                isLast={isLastAngle}
              >
                <AngleBody angle={a} copy={copy} locale={locale} />
              </SlotCard>
            );
          })}
        </div>
      );
    }
    case "metaphysics_action": {
      let idx = 0;
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p4">
          {page.dimensions.map((a, i) => {
            const evidence = evAt(slotEvidence, idx++);
            const isLast = i === page.dimensions.length - 1;
            const dimName = remapP4DimensionNameForCompliance(a.name);
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
    case "thirty_day":
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p5">
          {page.weeks.map((w, wi) => (
            <SlotCard
              key={w.week}
              title={`${copy.week(w.week)} · ${w.focus}`}
              locale={locale}
              evidence={evAt(slotEvidence, wi)}
              evidenceLabel={copy.evidenceFor(copy.week(w.week))}
            >
              <ul className="dps-list">
                {w.actions.map((a) => (
                  <li key={a}>
                    <Gloss text={a} locale={locale} />
                  </li>
                ))}
              </ul>
            </SlotCard>
          ))}
          <SlotCard
            title={copy.day7}
            locale={locale}
            evidence={evAt(slotEvidence, 4)}
            evidenceLabel={copy.evidenceFor(copy.day7)}
            isLast
          >
            <ul className="dps-list">
              {page.day7_checklist.map((x) => (
                <li key={x}>
                  <Gloss text={x} locale={locale} />
                </li>
              ))}
            </ul>
          </SlotCard>
        </div>
      );
    case "risk_guard": {
      /** Evidence order matches pageSchemaToArgumentBodies: red… · traps… · switch · protection… */
      let riskEvIdx = 0;
      const nextRiskEv = () => evAt(slotEvidence, riskEvIdx++);
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p6">
          <SlotCard
            title={copy.redLights}
            gloss={copy.redLightsGloss}
            locale={locale}
          >
            <div className="dps-risk-stack">
              {page.red_lights.map((x, i) => (
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
              {page.traps.map((x, i) => (
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
              {page.protection_rules.map((x, i) => (
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
    case "signals_close": {
      const day7Rows = page.day7_micro_actions
        .map((x) => coerceDay7Item(x))
        .filter((x): x is Day7Item => Boolean(x));
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
            evidence={evAt(slotEvidence, 1)}
            evidenceLabel={copy.evidenceFor(copy.quoteTitle)}
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
              evidence={evAt(slotEvidence, 4)}
              evidenceLabel={copy.evidenceFor(copy.takeaways)}
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
}: {
  markdown: string;
  locale: string;
  pageSchema?: DeliveryPageData | null;
  slotEvidence?: string[];
}) {
  const page = pageSchema ?? extractPageSchemaFromMarkdown(markdown);
  if (!page) return null;
  return (
    <PageSlotsInner page={page} locale={locale} slotEvidence={slotEvidence} />
  );
}

export function deliveryMarkdownWithoutSchemaFence(markdown: string): string {
  return stripPageSchemaFence(markdown);
}
