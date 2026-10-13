"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { inferTimezoneFromBirthLocation } from "@/lib/location/infer-birth-timezone";
import { formatCitySuggestionLabel } from "@/lib/location/nominatim-city-search";
import type { BirthInfo, BirthLocation } from "@/lib/profile/types";
import { hourToHourPeriod } from "@/lib/profile/birth-info-utils";
import { isBirthLocationComplete } from "@/lib/profile/validate-birth-location";

type CityHit = {
  name: string;
  city: string;
  state?: string;
  country: string;
  longitude: number;
  latitude: number;
};

type Props = {
  onReadyChange?: (ok: boolean) => void;
  /** Parent reads current BirthInfo via this ref; returns null if incomplete. */
  getBirthInfoRef: MutableRefObject<(() => BirthInfo | null) | null>;
  /** Avoid radio name clashes when multiple forms mount (e.g. partner dyad). */
  idPrefix?: string;
};

export function LabOpsBirthForm({
  onReadyChange,
  getBirthInfoRef,
  idPrefix = "lab",
}: Props) {
  const [year, setYear] = useState(1990);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [gender, setGender] = useState<"M" | "F">("M");
  const [location, setLocation] = useState<BirthLocation | null>(null);

  const [cityQuery, setCityQuery] = useState("");
  const [cityHits, setCityHits] = useState<CityHit[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const daysInMonth = new Date(year, month, 0).getDate();

  useEffect(() => {
    if (day > daysInMonth) setDay(daysInMonth);
  }, [day, daysInMonth]);

  useEffect(() => {
    getBirthInfoRef.current = () => {
      if (!isBirthLocationComplete(location)) return null;
      const tz =
        location!.timezone?.trim() ||
        inferTimezoneFromBirthLocation({
          name: location!.name,
          longitude: location!.longitude,
          latitude: location!.latitude,
        });
      return {
        year,
        month,
        day,
        hour,
        minute,
        hour_period: hourToHourPeriod(hour),
        gender,
        timezone: tz,
        birth_location: { ...location!, timezone: tz, use_defaults: false },
      };
    };
    onReadyChange?.(isBirthLocationComplete(location));
  }, [year, month, day, hour, minute, gender, location, getBirthInfoRef, onReadyChange]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = cityQuery.trim();
    if (q.length < 2) {
      setCityHits([]);
      return;
    }
    timerRef.current = setTimeout(() => {
      void (async () => {
        setCityLoading(true);
        try {
          const res = await fetch(
            `/api/location/search-city?q=${encodeURIComponent(q)}`,
          );
          const data = (await res.json()) as { results?: CityHit[] };
          setCityHits(Array.isArray(data.results) ? data.results : []);
        } catch {
          setCityHits([]);
        } finally {
          setCityLoading(false);
        }
      })();
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [cityQuery]);

  function pickCity(hit: CityHit) {
    const tz = inferTimezoneFromBirthLocation({
      name: hit.name,
      longitude: hit.longitude,
      latitude: hit.latitude,
    });
    setLocation({
      name: hit.name,
      longitude: hit.longitude,
      latitude: hit.latitude,
      timezone: tz,
      use_defaults: false,
    });
    setCityQuery("");
    setCityHits([]);
  }

  const inputCls =
    "rounded-md border border-white/10 bg-[#0b0f12] px-2 py-1.5 font-mono text-sm text-[#e4e4e7]";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-[#e4e4e7]">出生日期</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-[#a1a1aa]">
            年
            <input
              type="number"
              className={`${inputCls} w-20`}
              min={1920}
              max={2030}
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || 1990)}
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-[#a1a1aa]">
            月
            <input
              type="number"
              className={`${inputCls} w-14`}
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-[#a1a1aa]">
            日
            <input
              type="number"
              className={`${inputCls} w-14`}
              min={1}
              max={daysInMonth}
              value={day}
              onChange={(e) =>
                setDay(Math.min(daysInMonth, Math.max(1, Number(e.target.value) || 1)))
              }
            />
          </label>
        </div>
      </div>

      <div>
        <p className="text-sm text-[#e4e4e7]">出生时间</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-[#a1a1aa]">
            时
            <input
              type="number"
              className={`${inputCls} w-14`}
              min={0}
              max={23}
              value={hour}
              onChange={(e) => setHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-[#a1a1aa]">
            分
            <input
              type="number"
              className={`${inputCls} w-14`}
              min={0}
              max={59}
              value={minute}
              onChange={(e) => setMinute(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
            />
          </label>
          <span className="font-mono text-xs text-[#71717a]">
            {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
          </span>
        </div>
      </div>

      <div>
        <p className="text-sm text-[#e4e4e7]">出生地点</p>
        {location ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded border border-[#f2ca50]/30 bg-[#0b0f12] px-2 py-1.5 text-sm text-[#e4e4e7]">
              {location.name}
            </span>
            <button
              type="button"
              className="text-xs text-[#f2ca50] underline"
              onClick={() => setLocation(null)}
            >
              重选
            </button>
          </div>
        ) : (
          <div className="relative mt-1">
            <input
              type="text"
              className={`${inputCls} w-full`}
              placeholder="搜索城市（如：北京、Shanghai）"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              autoComplete="off"
            />
            {cityLoading ? (
              <p className="mt-1 text-[11px] text-[#71717a]">搜索中…</p>
            ) : null}
            {cityHits.length > 0 ? (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-white/15 bg-[#101417]">
                {cityHits.map((h) => (
                  <li key={`${h.name}-${h.longitude}`}>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                      onClick={() => pickCity(h)}
                    >
                      {formatCitySuggestionLabel(h.city, h.state, h.country)}
                      <span className="mt-0.5 block text-[10px] text-[#71717a]">{h.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        <p className="mt-1 text-[11px] text-[#71717a]">须选具体城市（真太阳时要用经纬度），不能空。</p>
      </div>

      <div>
        <p className="text-sm text-[#e4e4e7]">性别</p>
        <div className="mt-1 flex gap-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={`${idPrefix}-gender`}
              checked={gender === "M"}
              onChange={() => setGender("M")}
            />
            男
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={`${idPrefix}-gender`}
              checked={gender === "F"}
              onChange={() => setGender("F")}
            />
            女
          </label>
        </div>
      </div>
    </div>
  );
}
