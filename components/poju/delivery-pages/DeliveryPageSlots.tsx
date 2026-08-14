/**
 * Slot UI for page_schema_v1 — Eastern OS delivery surfaces.
 */

"use client";

import type { ReactNode } from "react";
import { GlossaryText } from "@/components/cross-product/GlossaryText";
import type { Locale } from "@/lib/glossary/term-glossary";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import {
  extractPageSchemaFromMarkdown,
  stripPageSchemaFence,
} from "@/lib/llm/pro/delivery/page-schema/render";

function SlotCard({
  title,
  children,
  tone = "default",
}: {
  title?: string;
  children: ReactNode;
  tone?: "default" | "primary" | "backup" | "alert" | "quote";
}) {
  return (
    <section className={`dps-card dps-card--${tone}`}>
      {title ? <h3 className="dps-card__title">{title}</h3> : null}
      <div className="dps-card__body">{children}</div>
    </section>
  );
}

function Gloss({ text, locale }: { text: string; locale: string }) {
  return <GlossaryText text={text} locale={locale as Locale} />;
}

function DimPills({
  dims,
}: {
  dims: { body: string; mind: string; field: string };
}) {
  return (
    <ul className="dps-dims" aria-label="Dimension levels">
      <li data-level={dims.body}>Body · {dims.body}</li>
      <li data-level={dims.mind}>Mind · {dims.mind}</li>
      <li data-level={dims.field}>Field · {dims.field}</li>
    </ul>
  );
}

function PageSlotsInner({ page, locale }: { page: DeliveryPageData; locale: string }) {
  switch (page.page) {
    case "direct_answer":
      return (
        <div className="dps-page dps-page--p1">
          <SlotCard tone="alert" title="Core judgment">
            <p className="dps-callout">
              <Gloss text={page.core_judgment} locale={locale} />
            </p>
          </SlotCard>
          <div className="dps-dual">
            <SlotCard tone="primary" title={`Primary · ${page.primary.name}`}>
              <p>
                <strong>Why</strong> · <Gloss text={page.primary.why} locale={locale} />
              </p>
              <p>
                <strong>When</strong> · <Gloss text={page.primary.when} locale={locale} />
              </p>
              <DimPills dims={page.primary.dims} />
            </SlotCard>
            <SlotCard tone="backup" title={`Backup · ${page.backup.name}`}>
              <p>
                <strong>Why</strong> · <Gloss text={page.backup.why} locale={locale} />
              </p>
              <p>
                <strong>When</strong> · <Gloss text={page.backup.when} locale={locale} />
              </p>
              <DimPills dims={page.backup.dims} />
            </SlotCard>
          </div>
        </div>
      );
    case "foundation":
      return (
        <div className="dps-page dps-page--p2">
          <div className="dps-dual">
            <SlotCard title="Surface">
              <Gloss text={page.surface_vs_essence.surface} locale={locale} />
            </SlotCard>
            <SlotCard title="Essence">
              <Gloss text={page.surface_vs_essence.essence} locale={locale} />
            </SlotCard>
          </div>
          <SlotCard title="True dashboard">
            <ul className="dps-dash">
              {page.dashboard.map((m) => (
                <li key={m.key}>
                  <span>{m.label}</span>
                  <strong>{m.score === null ? "—" : m.score}</strong>
                  {m.note ? <em>{m.note}</em> : null}
                </li>
              ))}
            </ul>
          </SlotCard>
          <div className="dps-stack">
            {page.why_cards.map((c) => (
              <SlotCard key={c.title} title={c.title}>
                <Gloss text={c.body} locale={locale} />
              </SlotCard>
            ))}
          </div>
        </div>
      );
    case "science_action":
      return (
        <div className="dps-page dps-page--p3">
          {page.opening ? (
            <p className="dps-opening">
              <Gloss text={page.opening} locale={locale} />
            </p>
          ) : null}
          <div className="dps-dual">
            {[page.primary_toolkit, page.backup_toolkit].map((t) => (
              <SlotCard
                key={t.role}
                tone={t.role === "primary" ? "primary" : "backup"}
                title={`${t.role === "primary" ? "Primary" : "Backup"} · ${t.title}`}
              >
                <p>
                  <strong>Strategy</strong> · <Gloss text={t.strategy} locale={locale} />
                </p>
                {t.exact_script ? (
                  <p className="dps-script">
                    <Gloss text={t.exact_script} locale={locale} />
                  </p>
                ) : null}
                <ol className="dps-steps">
                  {t.steps.map((s) => (
                    <li key={s}>
                      <Gloss text={s} locale={locale} />
                    </li>
                  ))}
                </ol>
                {t.hard_metrics.length > 0 ? (
                  <ul className="dps-metrics">
                    {t.hard_metrics.map((m) => (
                      <li key={m}>
                        <Gloss text={m} locale={locale} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </SlotCard>
            ))}
          </div>
          {page.alert ? (
            <SlotCard tone="alert" title="Alert">
              <Gloss text={page.alert} locale={locale} />
            </SlotCard>
          ) : null}
        </div>
      );
    case "metaphysics_action":
      return (
        <div className="dps-page dps-page--p4">
          <div className="dps-dual">
            {[page.primary_track, page.backup_track].map((t) => (
              <SlotCard
                key={t.role}
                tone={t.role === "primary" ? "primary" : "backup"}
                title={`${t.role === "primary" ? "Primary" : "Backup"} · ${t.title}`}
              >
                <p>
                  <strong>Strategy</strong> · <Gloss text={t.strategy} locale={locale} />
                </p>
                <ul>
                  {t.methods.map((m) => (
                    <li key={m}>
                      <Gloss text={m} locale={locale} />
                    </li>
                  ))}
                </ul>
              </SlotCard>
            ))}
          </div>
          <div className="dps-dual">
            <SlotCard title="Leverage">
              <ul>
                {page.leverage.map((x) => (
                  <li key={x}>
                    <Gloss text={x} locale={locale} />
                  </li>
                ))}
              </ul>
            </SlotCard>
            <SlotCard title="Avoid">
              <ul>
                {page.avoid.map((x) => (
                  <li key={x}>
                    <Gloss text={x} locale={locale} />
                  </li>
                ))}
              </ul>
            </SlotCard>
          </div>
          {page.field_matrix.length > 0 ? (
            <SlotCard title="Field matrix">
              <ul className="dps-matrix">
                {page.field_matrix.map((c) => (
                  <li key={c.label}>
                    <span>{c.label}</span>
                    <Gloss text={c.value} locale={locale} />
                  </li>
                ))}
              </ul>
            </SlotCard>
          ) : null}
        </div>
      );
    case "thirty_day":
      return (
        <div className="dps-page dps-page--p5">
          <ol className="dps-weeks">
            {page.weeks.map((w) => (
              <li key={w.week}>
                <SlotCard title={`Week ${w.week} · ${w.focus}`}>
                  <ul>
                    {w.actions.map((a) => (
                      <li key={a}>
                        <Gloss text={a} locale={locale} />
                      </li>
                    ))}
                  </ul>
                </SlotCard>
              </li>
            ))}
          </ol>
          <SlotCard title="Next 7 days">
            <ul className="dps-check">
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
        <div className="dps-page dps-page--p6">
          <SlotCard tone="alert" title="Red lights">
            <ul>
              {page.red_lights.map((x) => (
                <li key={x}>
                  <Gloss text={x} locale={locale} />
                </li>
              ))}
            </ul>
          </SlotCard>
          <SlotCard title="Traps">
            <ul>
              {page.traps.map((x) => (
                <li key={x}>
                  <Gloss text={x} locale={locale} />
                </li>
              ))}
            </ul>
          </SlotCard>
          <SlotCard tone="backup" title="Switch to backup">
            <Gloss text={page.switch_to_backup} locale={locale} />
          </SlotCard>
          <SlotCard title="Protection rules">
            <ul>
              {page.protection_rules.map((x) => (
                <li key={x}>
                  <Gloss text={x} locale={locale} />
                </li>
              ))}
            </ul>
          </SlotCard>
        </div>
      );
    case "signals_close":
      return (
        <div className="dps-page dps-page--p7">
          <div className="dps-dual">
            <SlotCard title="Before">
              <Gloss text={page.identity_before} locale={locale} />
            </SlotCard>
            <SlotCard tone="primary" title="After">
              <Gloss text={page.identity_after} locale={locale} />
            </SlotCard>
          </div>
          <SlotCard tone="quote">
            <blockquote className="dps-quote">
              <Gloss text={page.quote} locale={locale} />
            </blockquote>
          </SlotCard>
          <SlotCard tone="alert" title="Tonight · one thing">
            <Gloss text={page.immediate_action} locale={locale} />
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
}: {
  markdown: string;
  locale: string;
  pageSchema?: DeliveryPageData | null;
}) {
  const page = pageSchema ?? extractPageSchemaFromMarkdown(markdown);
  if (!page) return null;
  return <PageSlotsInner page={page} locale={locale} />;
}

export function deliveryMarkdownWithoutSchemaFence(markdown: string): string {
  return stripPageSchemaFence(markdown);
}

/** Skeleton for progressive unlock (waiting slot). */
export function DeliveryPageSlotSkeleton() {
  return (
    <div className="dps-skeleton" aria-busy="true" aria-label="Page loading">
      <div className="dps-skeleton__bar" />
      <div className="dps-skeleton__dual">
        <div className="dps-skeleton__card" />
        <div className="dps-skeleton__card" />
      </div>
      <div className="dps-skeleton__bar dps-skeleton__bar--short" />
    </div>
  );
}
