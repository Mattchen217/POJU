"use client";

import { useTranslations } from "next-intl";

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { resolveBaziLabel } from "@/lib/poju/resolve-bazi-i18n";

type Props = {
  structured: ProfileStructured;
  locale: string;
};

const PILLAR_KEYS = ["year", "month", "day", "hour"] as const;
const PILLAR_LABEL_KEYS = {
  year: "pillar_year",
  month: "pillar_month",
  day: "pillar_day",
  hour: "pillar_hour",
} as const;

function strengthLabel(strength: ProfileStructured["strength"], t: (k: string) => string): string {
  if (strength === "strong") return t("strength_strong");
  if (strength === "weak") return t("strength_weak");
  return t("strength_balanced");
}

export function BaseAnalysisPillarCard({ structured, locale }: Props) {
  const t = useTranslations("poju_matrix.card");
  const tb = useTranslations("bazi");
  const pd = structured.pillars_detail;

  return (
    <div className="base-analysis-pillar-card" aria-label={t("pillar_year")}>
      <div className="base-analysis-pillar-card__grid">
        {PILLAR_KEYS.map((key) => {
          const gz = structured.four_pillars[key];
          const detail = pd?.[key];
          const isDay = key === "day";
          return (
            <div
              key={key}
              className={`base-analysis-pillar-card__col${isDay ? " base-analysis-pillar-card__col--day" : ""}`}
            >
              <div className="base-analysis-pillar-card__cap">
                {t(PILLAR_LABEL_KEYS[key])}
              </div>
              <div className="base-analysis-pillar-card__gz">{gz}</div>
              {detail?.ten_god ? (
                <div className="base-analysis-pillar-card__meta">{detail.ten_god}</div>
              ) : null}
              {detail?.shen_sha?.length ? (
                <div className="base-analysis-pillar-card__stars">
                  {detail.shen_sha.slice(0, 3).join(" · ")}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="base-analysis-pillar-card__chips">
        <span className="base-analysis-pillar-card__chip base-analysis-pillar-card__chip--gold">
          {resolveBaziLabel(structured.day_master, tb) || structured.day_master}
        </span>
        <span className="base-analysis-pillar-card__chip">{strengthLabel(structured.strength, t)}</span>
        {structured.yong_shen ? (
          <span className="base-analysis-pillar-card__chip base-analysis-pillar-card__chip--fav">
            {tb("optimizing_vector")}: {structured.yong_shen}
          </span>
        ) : null}
        {structured.ji_shen.slice(0, 2).map((el) => (
          <span
            key={el}
            className="base-analysis-pillar-card__chip base-analysis-pillar-card__chip--chal"
          >
            {el}
          </span>
        ))}
      </div>
    </div>
  );
}
