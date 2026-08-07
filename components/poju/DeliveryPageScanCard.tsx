"use client";

import type { PageScanCardStruct } from "@/lib/llm/pro/delivery/poju-struct-blocks";

/** 3-second scannable strip at the top of each delivery page. */
export function DeliveryPageScanCard({ data }: { data: PageScanCardStruct }) {
  return (
    <section className="delivery-page-scan" aria-label={data.labels.title}>
      <p className="delivery-page-scan__eyebrow">{data.labels.title}</p>
      <div className="delivery-page-scan__grid">
        <div className="delivery-page-scan__cell">
          <span className="delivery-page-scan__label">{data.labels.strategy}</span>
          <span className="delivery-page-scan__value">{data.strategy}</span>
        </div>
        <div className="delivery-page-scan__cell">
          <span className="delivery-page-scan__label">{data.labels.homework}</span>
          <span className="delivery-page-scan__value">{data.homework}</span>
        </div>
        <div className="delivery-page-scan__cell">
          <span className="delivery-page-scan__label">{data.labels.key}</span>
          <span className="delivery-page-scan__value">{data.key}</span>
        </div>
      </div>
    </section>
  );
}
