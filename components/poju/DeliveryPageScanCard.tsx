"use client";

import type { PageScanCardStruct } from "@/lib/llm/pro/delivery/poju-struct-blocks";
import { normalizePageScanItems } from "@/lib/llm/pro/delivery/poju-struct-blocks";

/** Dynamic glance cards — labels/values authored by the model per page. */
export function DeliveryPageScanCard({ data }: { data: PageScanCardStruct }) {
  const items = normalizePageScanItems(data);
  if (items.length < 2) return null;

  return (
    <section className="delivery-page-scan" aria-label={data.labels.title}>
      <p className="delivery-page-scan__eyebrow">{data.labels.title}</p>
      <div
        className="delivery-page-scan__grid"
        style={{ ["--scan-cols" as string]: String(Math.min(4, items.length)) }}
      >
        {items.map((cell, i) => (
          <article key={`${cell.label}-${i}`} className="delivery-page-scan__card">
            <span className="delivery-page-scan__label">{cell.label}</span>
            <span className="delivery-page-scan__value">{cell.value}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
