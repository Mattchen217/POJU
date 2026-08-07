"use client";

import type { ThreePhaseRoadmapStruct } from "@/lib/llm/pro/delivery/poju-struct-blocks";

export function DeliveryThreePhaseRoadmap({ data }: { data: ThreePhaseRoadmapStruct }) {
  return (
    <section className="delivery-phase-roadmap" aria-label={data.labels.title}>
      <h3 className="delivery-phase-roadmap__title">{data.labels.title}</h3>
      <ol className="delivery-phase-roadmap__list">
        {data.phases.map((p) => (
          <li
            key={p.id}
            className={`delivery-phase-roadmap__item${p.current ? " is-current" : ""}`}
          >
            <span className="delivery-phase-roadmap__window">{p.window}</span>
            <span className="delivery-phase-roadmap__name">{p.title}</span>
            <span className="delivery-phase-roadmap__detail">{p.detail}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
