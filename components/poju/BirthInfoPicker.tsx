"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Picker from "react-mobile-picker";
import { BirthLocationStep } from "@/components/profile/BirthLocationStep";
import { buildDefaultBirthLocation } from "@/lib/profile/birth-info-utils";
import { HOUR_PERIOD_INFO, type BirthInfo, type HourPeriod } from "@/lib/profile/types";

const HOUR_PERIODS: HourPeriod[] = [
  "zi_early",
  "chou",
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai",
];

function monthEnglishName(m: number): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ?? String(m);
}

interface BirthInfoPickerProps {
  onSubmit: (info: BirthInfo) => void;
  onCancel?: () => void;
  locale: string;
}

export function BirthInfoPicker({ onSubmit, onCancel, locale }: BirthInfoPickerProps) {
  const t = useTranslations("birth_picker");

  const [step, setStep] = useState<"birth" | "location">("birth");
  const [year, setYear] = useState(1990);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [hourPeriod, setHourPeriod] = useState<HourPeriod>("wu");
  const [gender, setGender] = useState<"M" | "F">("M");

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = 1920; y <= 2030; y += 1) arr.push(y);
    return arr;
  }, []);

  const months = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], []);

  const days = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const arr: number[] = [];
    for (let d = 1; d <= daysInMonth; d += 1) arr.push(d);
    return arr;
  }, [year, month]);

  useEffect(() => {
    const max = days.length;
    if (day > max) setDay(max);
  }, [day, days.length]);

  const localeKey = locale.split("-")[0] === "zh" ? "zh" : "en";
  const userTimezone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC";

  function buildDraftBirthInfo(): Omit<BirthInfo, "birth_location"> {
    return {
      year,
      month,
      day,
      hour_period: hourPeriod,
      gender,
      timezone: userTimezone,
    };
  }

  function handleBirthStepContinue() {
    setStep("location");
  }

  function handleLocationComplete(birthLocation: BirthInfo["birth_location"]) {
    onSubmit({
      ...buildDraftBirthInfo(),
      birth_location: birthLocation,
    });
  }

  function handleLocationSkip() {
    onSubmit({
      ...buildDraftBirthInfo(),
      birth_location: buildDefaultBirthLocation(userTimezone),
    });
  }

  if (step === "location") {
    return (
      <div className="birth-info-picker">
        <BirthLocationStep
          userTimezone={userTimezone}
          onSelect={handleLocationComplete}
          onSkip={handleLocationSkip}
          onBack={() => setStep("birth")}
        />
      </div>
    );
  }

  return (
    <div className="birth-info-picker">
      <h2 className="picker-title">{t("title")}</h2>
      <p className="picker-description">{t("description")}</p>

      <div className="picker-section">
        <label>{t("birth_date")}</label>
        <Picker
          value={{ year, month, day }}
          onChange={(value) => {
            setYear(Number(value.year));
            setMonth(Number(value.month));
            setDay(Number(value.day));
          }}
          height={180}
          itemHeight={36}
          wheelMode="natural"
        >
          <Picker.Column name="year">
            {years.map((y) => (
              <Picker.Item key={y} value={y}>
                {({ selected }) => (
                  <div
                    style={{
                      color: selected ? "#D4AF37" : "#888",
                      fontSize: selected ? 18 : 16,
                      textAlign: "center",
                    }}
                  >
                    {y}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
          <Picker.Column name="month">
            {months.map((m) => (
              <Picker.Item key={m} value={m}>
                {({ selected }) => (
                  <div
                    style={{
                      color: selected ? "#D4AF37" : "#888",
                      fontSize: selected ? 18 : 16,
                      textAlign: "center",
                    }}
                  >
                    {localeKey === "zh" ? `${m} 月` : monthEnglishName(m)}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
          <Picker.Column name="day">
            {days.map((d) => (
              <Picker.Item key={d} value={d}>
                {({ selected }) => (
                  <div
                    style={{
                      color: selected ? "#D4AF37" : "#888",
                      fontSize: selected ? 18 : 16,
                      textAlign: "center",
                    }}
                  >
                    {localeKey === "zh" ? `${d} 日` : d}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
        </Picker>
      </div>

      <div className="picker-section">
        <label>{t("birth_hour")}</label>
        <Picker
          value={{ hour_period: hourPeriod }}
          onChange={(value) => setHourPeriod(value.hour_period as HourPeriod)}
          height={180}
          itemHeight={36}
          wheelMode="natural"
        >
          <Picker.Column name="hour_period">
            {HOUR_PERIODS.map((hp) => {
              const info = HOUR_PERIOD_INFO[hp];
              return (
                <Picker.Item key={hp} value={hp}>
                  {({ selected }) => (
                    <div
                      style={{
                        color: selected ? "#D4AF37" : "#888",
                        fontSize: selected ? 14 : 13,
                        textAlign: "center",
                        padding: "0 4px",
                      }}
                    >
                      {localeKey === "zh" ? info.zh_label : info.en_label}
                    </div>
                  )}
                </Picker.Item>
              );
            })}
          </Picker.Column>
        </Picker>
        <p className="hint">{t("hour_hint")}</p>
      </div>

      <div className="picker-section gender-section">
        <label>{t("gender")}</label>
        <div className="gender-buttons">
          <button type="button" className={`gender-btn ${gender === "M" ? "active" : ""}`} onClick={() => setGender("M")}>
            {t("male")}
          </button>
          <button type="button" className={`gender-btn ${gender === "F" ? "active" : ""}`} onClick={() => setGender("F")}>
            {t("female")}
          </button>
        </div>
      </div>

      <div className="timezone-display">
        <span>{t("timezone_label")}:</span>
        <span className="tz-value">{userTimezone}</span>
        <p className="hint">{t("timezone_hint")}</p>
      </div>

      <div className="picker-actions">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="cancel-btn">
            {t("back_to_list")}
          </button>
        ) : null}
        <button type="button" onClick={handleBirthStepContinue} className="submit-btn">
          {t("continue")}
        </button>
      </div>
    </div>
  );
}