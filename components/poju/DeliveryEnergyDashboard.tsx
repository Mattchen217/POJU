"use client";

import type { EnergyDashboardStruct } from "@/lib/llm/pro/delivery/poju-struct-blocks";

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function Bar(props: { label: string; value: number }) {
  const v = clampPct(props.value);
  return (
    <div className="delivery-energy-dash__row">
      <div className="delivery-energy-dash__row-head">
        <span className="delivery-energy-dash__label">{props.label}</span>
        <span className="delivery-energy-dash__value">{v}</span>
      </div>
      <div
        className="delivery-energy-dash__track"
        role="meter"
        aria-label={props.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
      >
        <div className="delivery-energy-dash__fill" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

/** P1 energy scores — plain white bars inside the shared section card. */
export function DeliveryEnergyDashboard({ data }: { data: EnergyDashboardStruct }) {
  return (
    <section className="delivery-energy-dash" aria-label={data.labels.title}>
      <h3 className="delivery-energy-dash__title">{data.labels.title}</h3>
      {data.source === "empty" ? (
        <p className="delivery-energy-dash__empty">{data.labels.empty_note}</p>
      ) : (
        <div className="delivery-energy-dash__bars">
          <Bar label={data.labels.output} value={data.output_capacity} />
          <Bar label={data.labels.sustain} value={data.sustain_capacity} />
          <Bar label={data.labels.resistance} value={data.resistance_load} />
        </div>
      )}
    </section>
  );
}
