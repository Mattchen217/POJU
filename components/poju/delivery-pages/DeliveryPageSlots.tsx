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
  DecisionTrack,
  DeliveryPageData,
  DimLevel,
  P1Page,
} from "@/lib/llm/pro/delivery/page-schema/types";
import {
  extractPageSchemaFromMarkdown,
  stripPageSchemaFence,
} from "@/lib/llm/pro/delivery/page-schema/render";

function slotUiCopy(locale: string) {
  const zh = locale.toLowerCase().startsWith("zh");
  return {
    coreJudgment: zh ? "核心判定" : "Core judgment",
    primary: zh ? "主方案" : "Primary",
    backup: zh ? "辅方案" : "Backup",
    primaryBadge: zh ? "优先推荐 · 攻坚破局轨" : "Preferred · breakthrough track",
    backupBadge: zh ? "托底退路 · 安全止损轨" : "Fallback · stop-loss track",
    matrixTitle: zh ? "主辅双轨决策对比" : "Primary vs backup matrix",
    matrixDim: zh ? "评估维度" : "Dimension",
    matrixGoal: zh ? "战略目标" : "Strategic goal",
    matrixBody: zh ? "身体消耗" : "Body load",
    matrixRisk: zh ? "现实风险" : "Field risk",
    matrixWhen: zh ? "适用触发点" : "Trigger",
    coreLogic: zh ? "核心打法" : "Core play",
    why: zh ? "为何" : "Why",
    when: zh ? "适用条件" : "When",
    whenBackup: zh ? "触发条件" : "Trigger",
    chip: zh ? "破局核心筹码" : "Breakthrough chip",
    dims: zh ? "执行消耗" : "Execution load",
    dimsHint: zh
      ? "走这条路时，身体 / 心理 / 现实各要扛多少"
      : "How much body, mind, and field this path demands",
    body: zh ? "身体" : "Body",
    mind: zh ? "心理" : "Mind",
    field: zh ? "现实" : "Field",
    dimBody: {
      high: zh ? "高消耗" : "High load",
      mid: zh ? "中等消耗" : "Mid load",
      low: zh ? "低消耗" : "Low load",
      unknown: zh ? "待测" : "n/a",
    },
    dimMind: {
      high: zh ? "高负荷" : "High load",
      mid: zh ? "中位" : "Mid",
      low: zh ? "低负荷" : "Low load",
      unknown: zh ? "待测" : "n/a",
    },
    dimField: {
      high: zh ? "高阻力" : "High friction",
      mid: zh ? "中等阻力" : "Mid friction",
      low: zh ? "低阻力" : "Low friction",
      unknown: zh ? "待测" : "n/a",
    },
    riskLabel: {
      high: zh ? "高风险" : "High risk",
      mid: zh ? "中风险" : "Mid risk",
      low: zh ? "极低风险" : "Very low risk",
      unknown: "—",
    },
    surface: zh ? "表象" : "Surface",
    essence: zh ? "本质" : "Essence",
    dashboard: zh ? "真算仪表盘" : "True dashboard",
    strategy: zh ? "策略" : "Strategy",
    means: zh ? "手段" : "Means",
    angle: zh ? "策略维" : "Angle",
    dimension: zh ? "相关维" : "Dimension",
    bridgeNote: zh
      ? "本页论证为何卡住、为何主辅成立；怎么做见后续科学/东方药方。"
      : "This page explains why you’re stuck and why the dual tracks hold; how-to lives on later pages.",
    leverage: zh ? "借力" : "Leverage",
    avoid: zh ? "避坑" : "Avoid",
    fieldMatrix: zh ? "场域矩阵" : "Field matrix",
    day7: zh ? "近7日微清单" : "7-day micro checklist",
    redLights: zh ? "红灯" : "Red lights",
    traps: zh ? "特有坑" : "Traps",
    switchBackup: zh ? "切辅开关" : "Switch to backup",
    protection: zh ? "防护法则" : "Protection rules",
    boundaryScript: zh ? "边界短句" : "Boundary line",
    before: zh ? "之前" : "Before",
    after: zh ? "之后" : "After",
    tonight: zh ? "今晚一件事" : "Tonight · one thing",
    alert: zh ? "注意" : "Alert",
    week: (n: number) => (zh ? `第${n}周` : `Week ${n}`),
    evidencePrimary: zh
      ? "展开【主方案】底层依据"
      : "Expand · primary underlying basis",
    evidenceBackup: zh
      ? "展开【辅方案】底层依据"
      : "Expand · backup underlying basis",
    evidenceJudgment: zh ? "展开 · 判定底层依据" : "Expand · judgment basis",
    evidenceFor: (title: string) =>
      zh ? `展开 · ${title}的底层依据` : `Expand · underlying basis for ${title}`,
  };
}

/** One module = existing book chrome (dot title + glass section-card). */
function SlotCard({
  title,
  children,
  evidence,
  evidenceLabel,
  locale,
  isLast,
}: {
  title?: string;
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
          <h2 className="delivery-book-stage__section-title">{title}</h2>
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

function Gloss({ text, locale }: { text: string; locale: string }) {
  return <GlossaryText text={text} locale={locale as Locale} />;
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
  const zh = locale.toLowerCase().startsWith("zh");
  return (
    <div className="delivery-book-stage__rx-parts">
      <Field label={copy.strategy}>
        <p>
          <Gloss text={angle.strategy} locale={locale} />
        </p>
      </Field>
      {angle.exact_script?.trim() ? (
        <Field label={zh ? "开口" : "Script"}>
          <p>
            <Gloss text={angle.exact_script} locale={locale} />
          </p>
        </Field>
      ) : null}
      <Field label={copy.means}>
        <ol className="dps-list">
          {angle.means.map((s) => (
            <li key={s}>
              <Gloss text={s} locale={locale} />
            </li>
          ))}
        </ol>
      </Field>
      {angle.hard_metrics.length > 0 ? (
        <Field label={zh ? "硬指标" : "Metrics"}>
          <ul className="dps-list">
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
                {track.core_logic
                  .split(/\n+/)
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((p) => (
                    <p key={p.slice(0, 24)}>
                      <Gloss text={p} locale={locale} />
                    </p>
                  ))}
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
      let idx = 1;
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p2">
          <p className="dps-p2-bridge-note">{copy.bridgeNote}</p>
          <SlotCard
            title={`${copy.surface} / ${copy.essence}`}
            locale={locale}
            evidence={evAt(slotEvidence, 0)}
            evidenceLabel={copy.evidenceFor(copy.surface)}
          >
            <div className="delivery-book-stage__rx-parts">
              <Field label={copy.surface}>
                <p>
                  <Gloss text={page.surface_vs_essence.surface} locale={locale} />
                </p>
              </Field>
              <Field label={copy.essence}>
                <p>
                  <Gloss text={page.surface_vs_essence.essence} locale={locale} />
                </p>
              </Field>
            </div>
          </SlotCard>
          <SlotCard title={copy.dashboard} locale={locale}>
            <ul className="dps-list">
              {page.dashboard.map((m) => (
                <li key={m.key}>
                  {m.label}
                  {": "}
                  <strong>{m.score === null ? "—" : m.score}</strong>
                  {m.note ? ` · ${m.note}` : null}
                </li>
              ))}
            </ul>
          </SlotCard>
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
                <p>
                  <Gloss text={c.body} locale={locale} />
                </p>
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
              <p>
                <Gloss text={page.opening} locale={locale} />
              </p>
            </SlotCard>
          ) : null}
          <header className="delivery-book-stage__section-head dps-track-head">
            <span className="delivery-book-stage__section-dot" aria-hidden />
            <h2 className="delivery-book-stage__section-title">
              {copy.primary} · {page.primary_toolkit.title}
            </h2>
          </header>
          {primaryAngles.map((a, i) => {
            const evidence = evAt(slotEvidence, idx++);
            return (
              <SlotCard
                key={`p-${a.name}-${i}`}
                title={`${copy.angle} · ${a.name}`}
                locale={locale}
                evidence={evidence}
                evidenceLabel={copy.evidenceFor(a.name)}
              >
                <AngleBody angle={a} copy={copy} locale={locale} />
              </SlotCard>
            );
          })}
          <header className="delivery-book-stage__section-head dps-track-head">
            <span className="delivery-book-stage__section-dot" aria-hidden />
            <h2 className="delivery-book-stage__section-title">
              {copy.backup} · {page.backup_toolkit.title}
            </h2>
          </header>
          {backupAngles.map((a, i) => {
            const evidence = evAt(slotEvidence, idx++);
            const isLastAngle = i === backupAngles.length - 1 && !page.alert;
            return (
              <SlotCard
                key={`b-${a.name}-${i}`}
                title={`${copy.angle} · ${a.name}`}
                locale={locale}
                evidence={evidence}
                evidenceLabel={copy.evidenceFor(a.name)}
                isLast={isLastAngle}
              >
                <AngleBody angle={a} copy={copy} locale={locale} />
              </SlotCard>
            );
          })}
          {page.alert ? (
            <SlotCard
              title={copy.alert}
              locale={locale}
              evidence={evAt(slotEvidence, idx)}
              evidenceLabel={copy.evidenceFor(copy.alert)}
              isLast
            >
              <p>
                <Gloss text={page.alert} locale={locale} />
              </p>
            </SlotCard>
          ) : null}
        </div>
      );
    }
    case "metaphysics_action": {
      let idx = 0;
      const primaryDims = page.primary_track.dimensions;
      const backupDims = page.backup_track.dimensions;
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p4">
          <header className="delivery-book-stage__section-head dps-track-head">
            <span className="delivery-book-stage__section-dot" aria-hidden />
            <h2 className="delivery-book-stage__section-title">
              {copy.primary} · {page.primary_track.title}
            </h2>
          </header>
          {primaryDims.map((a, i) => {
            const evidence = evAt(slotEvidence, idx++);
            return (
              <SlotCard
                key={`pd-${a.name}-${i}`}
                title={`${copy.dimension} · ${a.name}`}
                locale={locale}
                evidence={evidence}
                evidenceLabel={copy.evidenceFor(a.name)}
              >
                <AngleBody angle={a} copy={copy} locale={locale} />
              </SlotCard>
            );
          })}
          <header className="delivery-book-stage__section-head dps-track-head">
            <span className="delivery-book-stage__section-dot" aria-hidden />
            <h2 className="delivery-book-stage__section-title">
              {copy.backup} · {page.backup_track.title}
            </h2>
          </header>
          {backupDims.map((a, i) => {
            const evidence = evAt(slotEvidence, idx++);
            return (
              <SlotCard
                key={`bd-${a.name}-${i}`}
                title={`${copy.dimension} · ${a.name}`}
                locale={locale}
                evidence={evidence}
                evidenceLabel={copy.evidenceFor(a.name)}
              >
                <AngleBody angle={a} copy={copy} locale={locale} />
              </SlotCard>
            );
          })}
          <SlotCard
            title={copy.leverage}
            locale={locale}
            evidence={evAt(slotEvidence, idx++)}
            evidenceLabel={copy.evidenceFor(copy.leverage)}
          >
            <ul className="dps-list">
              {page.leverage.map((x) => (
                <li key={x}>
                  <Gloss text={x} locale={locale} />
                </li>
              ))}
            </ul>
          </SlotCard>
          <SlotCard
            title={copy.avoid}
            locale={locale}
            evidence={evAt(slotEvidence, idx++)}
            evidenceLabel={copy.evidenceFor(copy.avoid)}
            isLast={page.field_matrix.length === 0}
          >
            <ul className="dps-list">
              {page.avoid.map((x) => (
                <li key={x}>
                  <Gloss text={x} locale={locale} />
                </li>
              ))}
            </ul>
          </SlotCard>
          {page.field_matrix.length > 0 ? (
            <SlotCard title={copy.fieldMatrix} locale={locale} isLast>
              <ul className="dps-list">
                {page.field_matrix.map((c) => (
                  <li key={c.label}>
                    {c.label}: <Gloss text={c.value} locale={locale} />
                  </li>
                ))}
              </ul>
            </SlotCard>
          ) : null}
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
    case "risk_guard":
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p6">
          <SlotCard
            title={copy.redLights}
            locale={locale}
            evidence={evAt(slotEvidence, 0)}
            evidenceLabel={copy.evidenceFor(copy.redLights)}
          >
            <ul className="dps-list">
              {page.red_lights.map((x) => (
                <li key={x}>
                  <Gloss text={x} locale={locale} />
                </li>
              ))}
            </ul>
          </SlotCard>
          <SlotCard
            title={copy.traps}
            locale={locale}
            evidence={evAt(slotEvidence, 1)}
            evidenceLabel={copy.evidenceFor(copy.traps)}
          >
            <ul className="dps-list">
              {page.traps.map((x) => (
                <li key={x}>
                  <Gloss text={x} locale={locale} />
                </li>
              ))}
            </ul>
          </SlotCard>
          <SlotCard
            title={copy.switchBackup}
            locale={locale}
            evidence={evAt(slotEvidence, 2)}
            evidenceLabel={copy.evidenceFor(copy.switchBackup)}
          >
            <p>
              <Gloss text={page.switch_to_backup} locale={locale} />
            </p>
          </SlotCard>
          <SlotCard
            title={copy.protection}
            locale={locale}
            evidence={evAt(slotEvidence, 3)}
            evidenceLabel={copy.evidenceFor(copy.protection)}
            isLast={!page.boundary_script}
          >
            <ul className="dps-list">
              {page.protection_rules.map((x) => (
                <li key={x}>
                  <Gloss text={x} locale={locale} />
                </li>
              ))}
            </ul>
          </SlotCard>
          {page.boundary_script ? (
            <SlotCard
              title={copy.boundaryScript}
              locale={locale}
              evidence={evAt(slotEvidence, 4)}
              evidenceLabel={copy.evidenceFor(copy.boundaryScript)}
              isLast
            >
              <p className="dps-script">
                <Gloss text={page.boundary_script} locale={locale} />
              </p>
            </SlotCard>
          ) : null}
        </div>
      );
    case "signals_close":
      return (
        <div className="delivery-book-stage__modules dps-page dps-page--p7">
          <SlotCard
            title={`${copy.before} → ${copy.after}`}
            locale={locale}
            evidence={evAt(slotEvidence, 0)}
            evidenceLabel={copy.evidenceFor(copy.before)}
          >
            <div className="delivery-book-stage__rx-parts">
              <Field label={copy.before}>
                <p>
                  <Gloss text={page.identity_before} locale={locale} />
                </p>
              </Field>
              <Field label={copy.after}>
                <p>
                  <Gloss text={page.identity_after} locale={locale} />
                </p>
              </Field>
            </div>
          </SlotCard>
          <SlotCard
            locale={locale}
            evidence={evAt(slotEvidence, 1)}
            evidenceLabel={copy.evidenceFor("Quote")}
          >
            <blockquote className="dps-quote-plain">
              <Gloss text={page.quote} locale={locale} />
            </blockquote>
          </SlotCard>
          <SlotCard
            title={copy.tonight}
            locale={locale}
            evidence={evAt(slotEvidence, 2)}
            evidenceLabel={copy.evidenceFor(copy.tonight)}
          >
            <p>
              <Gloss text={page.immediate_action} locale={locale} />
            </p>
          </SlotCard>
          <SlotCard
            title={copy.day7}
            locale={locale}
            evidence={evAt(slotEvidence, 3)}
            evidenceLabel={copy.evidenceFor(copy.day7)}
            isLast
          >
            <ul className="dps-list">
              {page.day7_micro_actions.map((x) => (
                <li key={x}>
                  <Gloss text={x} locale={locale} />
                </li>
              ))}
            </ul>
          </SlotCard>
        </div>
      );
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

export function DeliveryPageSlotSkeleton() {
  return (
    <div
      className="delivery-book-stage__modules"
      aria-busy="true"
      aria-label="Page loading"
    >
      <article className="delivery-book-stage__module">
        <div className="delivery-book-stage__section-card dps-skeleton-card" />
      </article>
      <article className="delivery-book-stage__module">
        <div className="delivery-book-stage__section-card dps-skeleton-card" />
      </article>
    </div>
  );
}
