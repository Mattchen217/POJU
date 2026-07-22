"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Picker from "react-mobile-picker";

import { BirthLocationField } from "@/components/forms/BirthLocationField";
import { PickerWheelZone } from "@/components/poju/PickerWheelZone";
import { hourToHourPeriod } from "@/lib/profile/birth-info-utils";
import { isBirthLocationComplete } from "@/lib/profile/validate-birth-location";
import { type BirthInfo, type BirthLocation } from "@/lib/profile/types";

function monthEnglishName(m: number): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ?? String(m);
}

function padClock(n: number): string {
  return String(n).padStart(2, "0");
}

function PickerCell({ selected, children }: { selected: boolean; children: ReactNode }) {
  return (
    <div
      className={`picker-cell${selected ? " picker-cell--selected" : ""}`}
      style={{
        color: selected ? "#D4AF37" : "rgba(148, 163, 184, 0.45)",
        fontSize: selected ? 17 : 13,
        textAlign: "center",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </div>
  );
}

type Props = {
  onSubmit: (info: BirthInfo) => void;
  onCancel?: () => void;
  locale: string;
};

/**
 * Workspace-only birth form — same submit payload as BirthInfoPicker.
 * No page title/description; date+time as one horizontal Y-M-D-H-M wheel.
 */
export function WorkspaceBirthInfoPicker({ onSubmit, onCancel, locale }: Props) {
  const t = useTranslations("birth_picker");
  const tForm = useTranslations("birth_form");

  const [year, setYear] = useState(1990);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [gender, setGender] = useState<"M" | "F">("M");
  const [birthLocation, setBirthLocation] = useState<BirthLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

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

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  useEffect(() => {
    const max = days.length;
    if (day > max) setDay(max);
  }, [day, days.length]);

  const localeKey = locale.split("-")[0] === "zh" ? "zh" : "en";
  const userTimezone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC";

  const canSubmit = isBirthLocationComplete(birthLocation);

  function handleLocationChange(loc: BirthLocation) {
    setBirthLocation(loc);
    if (isBirthLocationComplete(loc)) setLocationError(null);
  }

  function handleSubmit() {
    if (!isBirthLocationComplete(birthLocation)) {
      setLocationError(tForm("location_required"));
      return;
    }

    onSubmit({
      year,
      month,
      day,
      hour,
      minute,
      hour_period: hourToHourPeriod(hour),
      gender,
      timezone: userTimezone,
      birth_location: birthLocation!,
    });
  }

  return (
    <div className="birth-info-picker birth-info-picker--workspace">
      <div className="picker-section picker-section--datetime">
        <label>{t("birth_datetime")}</label>
        <div className="picker-column-headers" aria-hidden="true">
          <span>{t("col_year")}</span>
          <span>{t("col_month")}</span>
          <span>{t("col_day")}</span>
          <span>{t("col_hour")}</span>
          <span>{t("col_minute")}</span>
        </div>
        <PickerWheelZone>
          <Picker
            value={{ year, month, day, hour, minute }}
            onChange={(value) => {
              setYear(Number(value.year));
              setMonth(Number(value.month));
              setDay(Number(value.day));
              setHour(Number(value.hour));
              setMinute(Number(value.minute));
            }}
            height={168}
            itemHeight={36}
            wheelMode="natural"
          >
            <Picker.Column name="year">
              {years.map((y) => (
                <Picker.Item key={y} value={y}>
                  {({ selected }) => <PickerCell selected={selected}>{y}</PickerCell>}
                </Picker.Item>
              ))}
            </Picker.Column>
            <Picker.Column name="month">
              {months.map((m) => (
                <Picker.Item key={m} value={m}>
                  {({ selected }) => (
                    <PickerCell selected={selected}>
                      {localeKey === "zh" ? `${m} 月` : monthEnglishName(m)}
                    </PickerCell>
                  )}
                </Picker.Item>
              ))}
            </Picker.Column>
            <Picker.Column name="day">
              {days.map((d) => (
                <Picker.Item key={d} value={d}>
                  {({ selected }) => (
                    <PickerCell selected={selected}>{localeKey === "zh" ? `${d} 日` : d}</PickerCell>
                  )}
                </Picker.Item>
              ))}
            </Picker.Column>
            <Picker.Column name="hour">
              {hours.map((h) => (
                <Picker.Item key={h} value={h}>
                  {({ selected }) => <PickerCell selected={selected}>{padClock(h)}</PickerCell>}
                </Picker.Item>
              ))}
            </Picker.Column>
            <Picker.Column name="minute">
              {minutes.map((m) => (
                <Picker.Item key={m} value={m}>
                  {({ selected }) => <PickerCell selected={selected}>{padClock(m)}</PickerCell>}
                </Picker.Item>
              ))}
            </Picker.Column>
          </Picker>
        </PickerWheelZone>
      </div>

      <div className="picker-section picker-section--location-gender">
        <div className="picker-section--location">
          <BirthLocationField value={birthLocation} onChange={handleLocationChange} />
          {locationError ? <p className="birth-location-step__error">{locationError}</p> : null}
        </div>
        <div className="picker-section__divider" aria-hidden="true" />
        <div className="gender-section">
          <label>{t("gender")}</label>
          <div className="gender-buttons">
            <button
              type="button"
              className={`gender-btn ${gender === "M" ? "active" : ""}`}
              onClick={() => setGender("M")}
            >
              {t("male")}
            </button>
            <button
              type="button"
              className={`gender-btn ${gender === "F" ? "active" : ""}`}
              onClick={() => setGender("F")}
            >
              {t("female")}
            </button>
          </div>
        </div>
      </div>

      <div className="timezone-display">
        <span>{t("timezone_label")}:</span>
        <span className="tz-value">{userTimezone}</span>
      </div>

      <div className="picker-actions">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="cancel-btn">
            {t("back_to_list")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleSubmit}
          className="submit-btn"
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
        >
          {t("submit")}
        </button>
      </div>
    </div>
  );
}
