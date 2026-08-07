"use client";

import type { PageScanCardStruct } from "@/lib/llm/pro/delivery/poju-struct-blocks";

/** Three independent glance cards — same total width as the prose card below. */
export function DeliveryPageScanCard({ data }: { data: PageScanCardStruct }) {
  const cells = [
    { label: data.labels.strategy, value: data.strategy },
    { label: data.labels.homework, value: data.homework },
    { label: data.labels.key, value: data.key },
  ] as const;

  return (
    <section className="delivery-page-scan" aria-label={data.labels.title}>
      <p className="delivery-page-scan__eyebrow">{data.labels.title}</p>
      <div className="delivery-page-scan__grid">
        {cells.map((cell) => (
          <article key={cell.label} className="delivery-page-scan__card">
            <span className="delivery-page-scan__label">{cell.label}</span>
            <span className="delivery-page-scan__value">{cell.value}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
