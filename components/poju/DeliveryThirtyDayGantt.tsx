"use client";

import { useCallback, useEffect, useState } from "react";
import type { ThirtyDayGanttStruct } from "@/lib/llm/pro/delivery/poju-struct-blocks";

function itemKey(week: number, track: "s" | "m", item: string): string {
  return `w${week}-${track}-${item.slice(0, 48)}`;
}

/**
 * Dual-track 4-week gantt with local checkbox persistence (prefs only — not chat).
 */
export function DeliveryThirtyDayGantt({
  data,
  storageKey,
}: {
  data: ThirtyDayGanttStruct;
  storageKey?: string;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      if (parsed && typeof parsed === "object") setChecked(parsed);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const toggle = useCallback(
    (key: string) => {
      setChecked((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        if (storageKey && typeof window !== "undefined") {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            /* ignore quota */
          }
        }
        return next;
      });
    },
    [storageKey],
  );

  return (
    <section className="delivery-thirty-gantt" aria-label={data.labels.title}>
      <h3 className="delivery-thirty-gantt__title">{data.labels.title}</h3>
      <div className="delivery-thirty-gantt__scroll">
        <table className="delivery-thirty-gantt__table">
          <thead>
            <tr>
              <th scope="col">{data.labels.week_col}</th>
              <th scope="col">{data.labels.science_col}</th>
              <th scope="col">{data.labels.metaphysics_col}</th>
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((w) => (
              <tr key={w.week}>
                <th scope="row">
                  <span className="delivery-thirty-gantt__week-num">{w.week}</span>
                  <span className="delivery-thirty-gantt__phase">{w.phase_label}</span>
                </th>
                <td>
                  <ul className="delivery-thirty-gantt__list">
                    {w.science.map((item) => {
                      const k = itemKey(w.week, "s", item);
                      return (
                        <li key={k}>
                          <label className="delivery-thirty-gantt__check">
                            <input
                              type="checkbox"
                              checked={Boolean(checked[k])}
                              onChange={() => toggle(k)}
                            />
                            <span>{item}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </td>
                <td>
                  <ul className="delivery-thirty-gantt__list">
                    {w.metaphysics.map((item) => {
                      const k = itemKey(w.week, "m", item);
                      return (
                        <li key={k}>
                          <label className="delivery-thirty-gantt__check">
                            <input
                              type="checkbox"
                              checked={Boolean(checked[k])}
                              onChange={() => toggle(k)}
                            />
                            <span>{item}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
