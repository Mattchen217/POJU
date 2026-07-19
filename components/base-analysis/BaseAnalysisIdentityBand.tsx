"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { getBaziChart } from "shunshi-bazi-core";

import { SoftTermHover } from "@/components/cross-product/GlossaryText";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildMatrixTopbandData } from "@/lib/poju/build-matrix-display";
import { resolveBaziLabel } from "@/lib/poju/resolve-bazi-i18n";
import { ZODIAC_ICON_BY_HAN } from "@/lib/poju/zodiac-icon-assets";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { UserProfile } from "@/lib/profile/types";

import "@/styles/poju-energy-matrix.css";

type Props = {
  userProfile: UserProfile;
  structured: ProfileStructured;
  locale: string;
  compact?: boolean;
};

export function BaseAnalysisIdentityBand({
  userProfile,
  structured,
  locale,
  compact = false,
}: Props) {
  const tc = useTranslations("poju_matrix.card");
  const tb = useTranslations("bazi");

  const display = useMemo(() => {
    const params = shunshiParamsFromBirthInfo(userProfile.birth);
    const chart = getBaziChart({
      year: params.year,
      month: params.month,
      day: params.day,
      hour: params.hour,
      minute: params.minute,
      gender: params.gender,
      city: params.city,
      latitude: params.latitude,
      longitude: params.longitude,
      standardMeridian: params.standardMeridian,
      useTrueSolarTime: true,
      sect: 1,
    });
    return buildMatrixTopbandData({
      profile: userProfile,
      structured,
      chart,
      locale,
    });
  }, [userProfile, structured, locale]);

  const zodiacIcon = ZODIAC_ICON_BY_HAN[display.zodiac.han];
  const tst = userProfile.tst_meta ?? userProfile.birth.tst_meta;
  const genderLabel = structured.bazi_enrichment?.gender_label
    ? resolveBaziLabel(structured.bazi_enrichment.gender_label, tb)
    : userProfile.birth.gender === "M"
      ? tb("gender.qian")
      : tb("gender.kun");

  return (
    <div className={`pem base-analysis-identity-band${compact ? " pem--compact" : ""}`}>
      <section className="device pem-matrix-body">
        <div className="topband">
          <div className="tcard zsign">
            <div className="zsign__art">
              {zodiacIcon ? (
                <Image
                  src={zodiacIcon}
                  alt=""
                  width={56}
                  height={56}
                  className="zsign__icon"
                />
              ) : (
                <span>{display.zodiac.han}</span>
              )}
            </div>
            <div className="zsign__en">{display.zodiac.en}</div>
            <div className="zsign__cn">
              {display.zodiac.han} · {display.zodiac.pinyin}
            </div>
            <div className="zsign__tag">{tc("your_sign_tag")}</div>
          </div>

          <div className="topband__calibration">
            <div className="topband__calibration-grid">
              <div className="tcard a tcard--nested">
                <div className="k">
                  <span className="bull" />
                  {tc("calendar_alignment")} <em>· {tc("calendar_alignment_em")}</em>
                </div>
                <div className="v">
                  {display.calendar.gregorian} <small>{tc("gregorian")}</small>
                </div>
                <div className="mid">
                  {display.calendar.headline}
                  {genderLabel ? <span className="pem__gender-tag">{genderLabel}</span> : null}
                </div>
                <div className="s">{display.calendar.lunar || display.calendar.mid}</div>
              </div>

              <div className="tcard a tcard--nested">
                <div className="k">
                  <span className="bull" />
                  <SoftTermHover slug="tm_true_solar_time" locale={locale} />
                  <em>· {tc("true_solar_time_em")}</em>
                </div>
                {tst ? (
                  <>
                    <div className="tst">
                      <div className="tst__times">
                        <div className="t">
                          <div className="vv">{tst.original_time}</div>
                          <div className="kk">{tc("standard_time")}</div>
                        </div>
                        <div className="arr">→</div>
                        <div className="t">
                          <div className="vv gold">{tst.true_solar_time}</div>
                          <div className="kk">
                            <SoftTermHover slug="tm_true_solar_time" locale={locale} />
                          </div>
                        </div>
                      </div>
                      {tst.diff_minutes !== 0 ? (
                        <div className="tst__chip">
                          {tst.diff_minutes > 0 ? "+" : "−"}
                          {Math.abs(Number(tst.diff_minutes.toFixed(2)))}m
                        </div>
                      ) : null}
                    </div>
                    <div className="s">
                      {tc("longitude_correction")} ·{" "}
                      {tst.longitude_diff_minutes ?? tst.diff_minutes}m
                      {tst.eq_of_time_minutes != null
                        ? ` · ${tc("eq_of_time")} ${tst.eq_of_time_minutes > 0 ? "+" : ""}${tst.eq_of_time_minutes}m`
                        : null}
                    </div>
                  </>
                ) : (
                  <div className="v">—</div>
                )}
              </div>

              <div className="tcard a tcard--nested">
                <div className="k">
                  <span className="bull" />
                  {tc("solar_term")} <em>· {tc("solar_term_em")}</em>
                </div>
                <div className="v">
                  {display.solar_term.name_en} <small>{display.solar_term.name}</small>
                </div>
                <div className="mid">{display.solar_term.season}</div>
                <div className="s">
                  {tc("next_term")}: {display.solar_term.next_name}
                </div>
                <div className="term">
                  <i style={{ width: `${display.solar_term.progress_pct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
