"use client";

import type { ThirtyDayGanttStruct } from "@/lib/llm/pro/delivery/poju-struct-blocks";

export function DeliveryThirtyDayGantt({ data }: { data: ThirtyDayGanttStruct }) {
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
                    {w.science.map((item) => (
                      <li key={item}>
                        <label className="delivery-thirty-gantt__check">
                          <input type="checkbox" />
                          <span>{item}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </td>
                <td>
                  <ul className="delivery-thirty-gantt__list">
                    {w.metaphysics.map((item) => (
                      <li key={item}>
                        <label className="delivery-thirty-gantt__check">
                          <input type="checkbox" />
                          <span>{item}</span>
                        </label>
                      </li>
                    ))}
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
