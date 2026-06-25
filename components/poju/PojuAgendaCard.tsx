import type { AgendaItem } from "@/lib/poju/investigation-agenda";

type Props = {
  items: AgendaItem[];
  locale: string;
};

export function PojuAgendaCard({ items, locale }: Props) {
  if (items.length === 0) return null;
  const zh = locale.startsWith("zh");

  return (
    <div className="poju-agenda-card" aria-label={zh ? "待弄清清单" : "Investigation agenda"}>
      <div className="poju-agenda-card__title">{zh ? "待弄清清单" : "To clarify"}</div>
      <ul className="poju-agenda-card__list">
        {items.map((item) => {
          const covered = item.status === "covered";
          const partial = item.status === "partial";
          return (
            <li
              key={item.id}
              className={[
                "poju-agenda-card__item",
                covered ? "poju-agenda-card__item--covered" : "",
                partial ? "poju-agenda-card__item--partial" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="poju-agenda-card__label">{item.label}</span>
              {item.critical ? (
                <span className="poju-agenda-card__badge">
                  {zh ? "必查" : "critical"}
                </span>
              ) : null}
              {covered ? (
                <span className="poju-agenda-card__status">{zh ? "已弄清" : "covered"}</span>
              ) : partial ? (
                <span className="poju-agenda-card__status">{zh ? "部分" : "partial"}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
