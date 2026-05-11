"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SyncroDirectionRow } from "@/lib/ai/mock-syncro";
import { getNextShichenBoundary } from "@/lib/calculations";
import { getUserProfile } from "@/lib/profile/storage";
import { directionRowsFromM6 } from "@/lib/syncro/direction-rows-from-m6";
import type { ArchiveEntry } from "@/lib/archive/types";

type PermissionState = "idle" | "granted" | "denied";
type SyncroMode = "overhead" | "ar";
type CaptureState = "idle" | "holding" | "analyzing" | "result";
type ShichenEntry = {
  name: "Zi" | "Chou" | "Yin" | "Mao" | "Chen" | "Si" | "Wu" | "Wei" | "Shen" | "You" | "Xu" | "Hai";
  chinese: string;
  label: string;
  startHour: number;
};

type FormState = {
  year: string;
  month: string;
  day: string;
  shichen: string;
  gender: "Male" | "Female" | "Other";
  profession: string;
};

const FORM_KEY = "pojulife_syncro_profile_v1";
const TUTORIAL_KEY = "pojulife_syncro_tutorial_seen";
const SYNCRO_ARCHIVE_KEY = "pojulife_syncro_archive_v1";
const ARCHIVE_RUNTIME_KEY = "pojulife_archive_runtime_v1";

const SHICHEN_OPTIONS = [
  "11 PM – 1 AM (Midnight / Zi)",
  "1 AM – 3 AM (Late Night / Chou)",
  "3 AM – 5 AM (Before Dawn / Yin)",
  "5 AM – 7 AM (Sunrise / Mao)",
  "7 AM – 9 AM (Morning / Chen)",
  "9 AM – 11 AM (Late Morning / Si)",
  "11 AM – 1 PM (Noon / Wu)",
  "1 PM – 3 PM (Early Afternoon / Wei)",
  "3 PM – 5 PM (Late Afternoon / Shen)",
  "5 PM – 7 PM (Sunset / You)",
  "7 PM – 9 PM (Evening / Xu)",
  "9 PM – 11 PM (Night / Hai)",
  "Not sure",
] as const;

const PROF_OPTIONS = [
  "Lawyer / Legal",
  "Doctor / Medical",
  "Teacher / Educator",
  "Engineer / Developer",
  "Artist / Creative",
  "Entrepreneur / Founder",
  "Finance / Investment",
  "Sales / Marketing",
  "Manager / Executive",
  "Student",
  "Retired",
  "Homemaker",
  "Other",
] as const;

const SHICHEN_MAP: ReadonlyArray<ShichenEntry> = [
  { name: "Zi", chinese: "子", label: "Midnight", startHour: 23 },
  { name: "Chou", chinese: "丑", label: "Late Night", startHour: 1 },
  { name: "Yin", chinese: "寅", label: "Pre-Dawn", startHour: 3 },
  { name: "Mao", chinese: "卯", label: "Sunrise", startHour: 5 },
  { name: "Chen", chinese: "辰", label: "Morning", startHour: 7 },
  { name: "Si", chinese: "巳", label: "Late Morning", startHour: 9 },
  { name: "Wu", chinese: "午", label: "Noon", startHour: 11 },
  { name: "Wei", chinese: "未", label: "Early Afternoon", startHour: 13 },
  { name: "Shen", chinese: "申", label: "Afternoon", startHour: 15 },
  { name: "You", chinese: "酉", label: "Sunset", startHour: 17 },
  { name: "Xu", chinese: "戌", label: "Evening", startHour: 19 },
  { name: "Hai", chinese: "亥", label: "Night", startHour: 21 },
] as const;

function getCurrentShichen(date: Date): ShichenEntry {
  const hour = date.getHours();
  if (hour >= 23 || hour < 1) return SHICHEN_MAP[0];
  const idx = Math.floor((hour - 1) / 2) + 1;
  return SHICHEN_MAP[Math.min(11, Math.max(1, idx))];
}

function parseBirthYear(year: string): number {
  const y = Number.parseInt(year.trim(), 10);
  if (Number.isFinite(y) && y >= 1900 && y <= 2100) return y;
  return 1990;
}

export function SyncroMobileFlow() {
  const searchParams = useSearchParams();
  const [geo, setGeo] = useState<PermissionState>("idle");
  const [compass, setCompass] = useState<PermissionState>("idle");
  const [camera, setCamera] = useState<PermissionState>("idle");
  const [tutorialOpen, setTutorialOpen] = useState(true);
  const [dontShow, setDontShow] = useState(false);
  const [form, setForm] = useState<FormState>({
    year: "",
    month: "",
    day: "",
    shichen: "Not sure",
    gender: "Other",
    profession: "",
  });
  const [mode, setMode] = useState<SyncroMode>("overhead");
  const [lockMode, setLockMode] = useState(false);
  const [zAxis, setZAxis] = useState(1);
  const [heading, setHeading] = useState(0);
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [spotName, setSpotName] = useState("");
  const [captureSavedToast, setCaptureSavedToast] = useState("");
  const [holdProgress, setHoldProgress] = useState(0);
  const [nextShiftInSec, setNextShiftInSec] = useState(0);
  const [ritualToast, setRitualToast] = useState("");
  const [retuneTick, setRetuneTick] = useState(0);
  const [profileBirthYear, setProfileBirthYear] = useState<number | null>(null);
  const [currentShichen, setCurrentShichen] = useState<ShichenEntry>(() => getCurrentShichen(new Date()));
  const [directionRows, setDirectionRows] = useState<SyncroDirectionRow[]>(() =>
    directionRowsFromM6({ birthYear: 1990, headingDeg: 0 }),
  );
  const [archiveReplay, setArchiveReplay] = useState<{
    id: string;
    name: string;
    direction: string;
    rating: string;
    best: string;
    avoid: string;
    createdAt: number;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FORM_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FormState>;
        setForm((prev) => ({ ...prev, ...parsed }));
      }
      const seen = localStorage.getItem(TUTORIAL_KEY) === "1";
      if (seen) setTutorialOpen(false);
      setDontShow(seen);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const from = searchParams.get("from");
    const kind = searchParams.get("kind");
    const entry = searchParams.get("entry");
    if (from !== "archive" || kind !== "syncro" || !entry) return;
    try {
      const rawArchive = localStorage.getItem(ARCHIVE_RUNTIME_KEY);
      const rows = rawArchive ? (JSON.parse(rawArchive) as ArchiveEntry[]) : [];
      const archiveHit = rows.find((r) => r.id === entry && r.kind === "syncro");
      if (!archiveHit?.refId) return;
      const rawSyncro = localStorage.getItem(SYNCRO_ARCHIVE_KEY);
      const captures = rawSyncro
        ? (JSON.parse(rawSyncro) as Array<{
            id: string;
            createdAt: number;
            direction: string;
            name: string;
            rating: string;
            best: string;
            avoid: string;
          }>)
        : [];
      const hit = captures.find((c) => c.id === archiveHit.refId);
      if (!hit) return;
      setArchiveReplay({
        id: hit.id,
        name: hit.name,
        direction: hit.direction,
        rating: hit.rating,
        best: hit.best,
        avoid: hit.avoid,
        createdAt: hit.createdAt,
      });
      setSpotName(hit.name);
      setCaptureState("result");
      setCaptureSavedToast(`Loaded from Archive: ${hit.name}`);
      window.setTimeout(() => setCaptureSavedToast(""), 2200);
    } catch {
      // ignore
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify(form));
    } catch {
      // ignore
    }
  }, [form]);

  useEffect(() => {
    const onMotion = (e: DeviceMotionEvent) => {
      const z = e.accelerationIncludingGravity?.z;
      if (typeof z !== "number") return;
      setZAxis(z);
      if (lockMode) return;
      if (z > 0.8) setMode("overhead");
      if (z < 0.3) setMode("ar");
    };

    const onOrientation = (e: DeviceOrientationEvent) => {
      const alpha = typeof e.alpha === "number" ? e.alpha : 0;
      setHeading(alpha);
    };

    window.addEventListener("devicemotion", onMotion);
    window.addEventListener("deviceorientation", onOrientation);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, [lockMode]);

  useEffect(() => {
    // Task 3: 下一时辰整点触发（setTimeout 递归）
    let timeoutId = 0 as number | 0;
    const tick = () => {
      const now = new Date();
      const from = getCurrentShichen(now);
      const nextBoundary = getNextShichenBoundary(now);
      const to = getCurrentShichen(new Date(nextBoundary.getTime() + 1000));
      const msUntilNext = Math.max(0, nextBoundary.getTime() - now.getTime());
      setCurrentShichen(from);
      setNextShiftInSec(Math.floor(msUntilNext / 1000));

      timeoutId = window.setTimeout(() => {
        setRitualToast(
          `✦ ${from.name} hour has closed. ${to.name} hour (${to.label}) begins. Your field is being retuned...`,
        );
        setRetuneTick((n) => n + 1);
        setCurrentShichen(to);
        window.setTimeout(() => setRitualToast(""), 4200);
        tick();
      }, msUntilNext);
    };

    tick();
    const interval = window.setInterval(() => {
      const now = new Date();
      const nextBoundary = getNextShichenBoundary(now);
      const remain = Math.max(0, Math.floor((nextBoundary.getTime() - now.getTime()) / 1000));
      setNextShiftInSec(remain);
    }, 1000);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      window.clearInterval(interval);
    };
  }, []);

  const grantPermissions = async () => {
    // Step 1: Geolocation
    if (navigator.geolocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            setGeo("granted");
            resolve();
          },
          () => {
            setGeo("denied");
            resolve();
          },
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 8000 },
        );
      });
    } else {
      setGeo("denied");
    }

    // Step 2: iOS compass permission (if present)
    try {
      const DeviceOrientationEventAny = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (typeof DeviceOrientationEventAny.requestPermission === "function") {
        const result = await DeviceOrientationEventAny.requestPermission();
        setCompass(result === "granted" ? "granted" : "denied");
      } else {
        setCompass("granted");
      }
    } catch {
      setCompass("denied");
    }

    // Step 3: Camera permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((t) => t.stop());
      setCamera("granted");
    } catch {
      setCamera("denied");
    }
  };

  const permissionOk = useMemo(() => geo === "granted" && compass === "granted" && camera === "granted", [geo, compass, camera]);
  const directionIndex = Math.round((((heading % 360) + 360) % 360) / 45) % 8;
  const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  useEffect(() => {
    void (async () => {
      const profile = await getUserProfile();
      if (profile?.birth.year) setProfileBirthYear(profile.birth.year);
    })();
  }, []);

  useEffect(() => {
    const birthYear = parseBirthYear(form.year);
    const effectiveBirthYear = profileBirthYear ?? birthYear;
    // Ratings depend on hour + 用神, not on compass heading; heading only selects the active row in UI.
    setDirectionRows(directionRowsFromM6({ birthYear: effectiveBirthYear, headingDeg: 0, at: new Date() }));
  }, [retuneTick, form.year, profileBirthYear]);
  const activeRow = directionRows[directionIndex];
  const holdTimerRef = useMemo(() => ({ id: 0 as number | 0, progressId: 0 as number | 0 }), []);
  const isCapturing = captureState === "holding" || captureState === "analyzing";

  const startHoldCapture = () => {
    if (mode !== "ar" || isCapturing) return;
    setCaptureState("holding");
    setHoldProgress(0);
    const started = Date.now();
    holdTimerRef.progressId = window.setInterval(() => {
      const elapsed = Date.now() - started;
      setHoldProgress(Math.min(100, Math.round((elapsed / 1000) * 100)));
    }, 40);
    holdTimerRef.id = window.setTimeout(() => {
      if (holdTimerRef.progressId) {
        window.clearInterval(holdTimerRef.progressId);
        holdTimerRef.progressId = 0;
      }
      setHoldProgress(100);
      setCaptureState("analyzing");
      window.setTimeout(() => {
        setCaptureState("result");
      }, 2000);
    }, 1000);
  };

  const cancelHoldCapture = () => {
    if (captureState !== "holding") return;
    if (holdTimerRef.id) {
      window.clearTimeout(holdTimerRef.id);
      holdTimerRef.id = 0;
    }
    if (holdTimerRef.progressId) {
      window.clearInterval(holdTimerRef.progressId);
      holdTimerRef.progressId = 0;
    }
    setHoldProgress(0);
    setCaptureState("idle");
  };

  const saveCaptureToArchive = () => {
    const payload = {
      id: `syncro_${Date.now()}`,
      createdAt: Date.now(),
      direction: activeRow.dir,
      heading: Math.round(heading),
      name: spotName.trim() || `Facing ${activeRow.dir}`,
      rating: activeRow.rating,
      best: activeRow.best,
      avoid: activeRow.avoid,
    };
    try {
      const raw = localStorage.getItem(SYNCRO_ARCHIVE_KEY);
      const list = raw ? (JSON.parse(raw) as Array<typeof payload>) : [];
      localStorage.setItem(SYNCRO_ARCHIVE_KEY, JSON.stringify([payload, ...list]));
      const rawArchive = localStorage.getItem(ARCHIVE_RUNTIME_KEY);
      const archiveList = rawArchive ? (JSON.parse(rawArchive) as ArchiveEntry[]) : [];
      const archiveRow: ArchiveEntry = {
        id: `syncro_archive_${Date.now()}`,
        kind: "syncro",
        createdAt: payload.createdAt,
        title: `${new Date(payload.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · Syncro`,
        subtitle: `"${payload.name}" · Facing ${payload.direction} · ${currentShichen.name} hour`,
        refId: payload.id,
      };
      localStorage.setItem(ARCHIVE_RUNTIME_KEY, JSON.stringify([archiveRow, ...archiveList].slice(0, 120)));
      setCaptureSavedToast(`Saved: ${payload.name}`);
      setTimeout(() => setCaptureSavedToast(""), 2400);
    } catch {
      setCaptureSavedToast("Saved locally.");
      setTimeout(() => setCaptureSavedToast(""), 2400);
    }
  };

  const beginReading = () => {
    // Task 3 第一阶段骨架：这里先给出可验证入口状态，后续接主体验。
    alert("Syncro setup captured. Main reading flow will continue in Task 3 implementation.");
  };

  return (
    <section className="mx-auto mt-6 w-full max-w-6xl px-4 md:hidden">
      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-900/10 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/85">Syncro Mobile Flow · Task 3</p>
        <h2 className="mt-2 text-[20px] font-semibold text-text-primary">Permissions and calibration setup</h2>
        <p className="mt-2 text-sm leading-7 text-text-secondary">
          Grant permissions first, then complete the profile form. Data stays on this device.
        </p>

        <button
          type="button"
          onClick={() => void grantPermissions()}
          className="mt-4 rounded-full border border-cyan-300/35 bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-100"
        >
          Grant permissions
        </button>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <p className="rounded bg-black/20 px-2 py-1 text-center">GPS: {geo}</p>
          <p className="rounded bg-black/20 px-2 py-1 text-center">Compass: {compass}</p>
          <p className="rounded bg-black/20 px-2 py-1 text-center">Camera: {camera}</p>
        </div>
      </div>

      {tutorialOpen ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
          <h3 className="text-[16px] font-semibold text-text-primary">How Syncro reads you</h3>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-text-secondary">
            <li>✦ Session timing — calendar windows aligned with your birth context</li>
            <li>✦ Direction grid — headings mapped into eight directional zones</li>
            <li>✦ Phase cues — emphasis shifts across the day&apos;s cycle</li>
            <li>✦ Sensor fusion — compass, GPS, and daylight timing for local context</li>
          </ul>
          <label className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
            Don&apos;t show this again
          </label>
          <button
            type="button"
            onClick={() => {
              if (dontShow) localStorage.setItem(TUTORIAL_KEY, "1");
              setTutorialOpen(false);
            }}
            className="mt-3 rounded-full border border-white/15 px-4 py-2 text-sm text-text-primary"
          >
            Got it, continue ↓
          </button>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
        <h3 className="text-[16px] font-semibold text-text-primary">Profile input</h3>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <input
            value={form.year}
            onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
            placeholder="Year"
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
          <input
            value={form.month}
            onChange={(e) => setForm((p) => ({ ...p, month: e.target.value }))}
            placeholder="Month"
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
          <input
            value={form.day}
            onChange={(e) => setForm((p) => ({ ...p, day: e.target.value }))}
            placeholder="Day"
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
        </div>
        <select
          value={form.shichen}
          onChange={(e) => setForm((p) => ({ ...p, shichen: e.target.value }))}
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
        >
          {SHICHEN_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["Male", "Female", "Other"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setForm((p) => ({ ...p, gender: g }))}
              className={`rounded-lg border px-3 py-2 text-sm ${
                form.gender === g ? "border-cyan-300/45 bg-cyan-400/15 text-cyan-100" : "border-white/10 text-text-secondary"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <select
          value={form.profession}
          onChange={(e) => setForm((p) => ({ ...p, profession: e.target.value }))}
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
        >
          <option value="">Select profession</option>
          {PROF_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!permissionOk}
          onClick={beginReading}
          className="mt-4 w-full rounded-full border border-cyan-300/35 bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Begin Reading →
        </button>
        <p className="mt-2 text-xs text-text-dim">Your info stays on this device.</p>
      </div>

      {permissionOk ? (
        <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-900/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Syncro view</p>
            <button
              type="button"
              onClick={() => setLockMode((v) => !v)}
              className={`rounded-full border px-3 py-1 text-xs ${
                lockMode ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-100" : "border-white/15 text-text-secondary"
              }`}
            >
              {lockMode ? "Mode locked" : "Auto mode"}
            </button>
          </div>
          <p className="mt-1 text-xs text-text-dim">
            z-axis: {zAxis.toFixed(2)} · heading: {Math.round(heading)}° · mode: {mode.toUpperCase()}
          </p>
          <p className="mt-1 text-xs text-cyan-100/85">
            {currentShichen.name} hour ({currentShichen.label}) · Next shift in {Math.floor(nextShiftInSec / 60)}m{" "}
            {nextShiftInSec % 60}s
          </p>

          {mode === "overhead" ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-text-dim">Overhead · 8 directions</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                {directionRows.map((row) => (
                  <div
                    key={row.dir}
                    className={`rounded-lg border px-2 py-2 ${
                      row.dir === DIRECTIONS[directionIndex]
                        ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
                        : "border-white/10 text-text-secondary"
                    }`}
                  >
                    <p className="font-semibold">
                      {row.dir} · {row.rating}
                    </p>
                    <p className="mt-1">Best: {row.best}</p>
                    <p className="mt-1 text-text-dim">Avoid: {row.avoid}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-text-dim">AR card · current heading</p>
              <button
                type="button"
                onMouseDown={startHoldCapture}
                onMouseUp={cancelHoldCapture}
                onMouseLeave={cancelHoldCapture}
                onTouchStart={startHoldCapture}
                onTouchEnd={cancelHoldCapture}
                className="mt-2 block w-full rounded-lg border border-cyan-300/35 bg-cyan-400/10 p-3 text-left text-sm"
              >
                <p className="font-semibold text-cyan-100">
                  {activeRow.dir} · {activeRow.rating}
                </p>
                <p className="mt-2 text-text-secondary">
                  <span className="text-text-primary">Best For:</span> {activeRow.best}
                </p>
                <p className="mt-1 text-text-dim">
                  <span className="text-text-secondary">Avoid:</span> {activeRow.avoid}
                </p>
                <p className="mt-2 text-xs text-cyan-100/90">Hold 1 second to capture this direction.</p>
                {captureState === "holding" ? (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/40">
                    <div className="h-full bg-cyan-300/80 transition-all" style={{ width: `${holdProgress}%` }} />
                  </div>
                ) : null}
              </button>

              {captureState === "analyzing" ? (
                <p className="mt-3 text-xs text-cyan-100/90">Reading the signal from this direction...</p>
              ) : null}

              {captureState === "result" ? (
                <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
                  <p className="text-sm font-semibold text-text-primary">
                    Facing {activeRow.dir}, slightly toward{" "}
                    {DIRECTIONS[(directionIndex + 7) % 8]}
                  </p>
                  <p className="mt-1 text-xs text-text-dim">
                    {new Date().toLocaleDateString()} · {new Date().toLocaleTimeString()}
                  </p>
                  <input
                    value={spotName}
                    onChange={(e) => setSpotName(e.target.value)}
                    placeholder="Name this direction"
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={saveCaptureToArchive}
                      className="rounded-lg border border-cyan-300/35 bg-cyan-400/20 px-3 py-2 text-xs font-semibold text-cyan-100"
                    >
                      Save to Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => setCaptureState("idle")}
                      className="rounded-lg border border-white/12 px-3 py-2 text-xs text-text-secondary"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {archiveReplay ? (
        <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-900/10 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/85">Archive replay</p>
          <p className="mt-2 text-sm font-semibold text-text-primary">
            {archiveReplay.name} · Facing {archiveReplay.direction} · {archiveReplay.rating}
          </p>
          <p className="mt-1 text-xs text-text-dim">{new Date(archiveReplay.createdAt).toLocaleString()}</p>
          <p className="mt-2 text-sm text-text-secondary">
            <span className="text-text-primary">Best For:</span> {archiveReplay.best}
          </p>
          <p className="mt-1 text-sm text-text-dim">
            <span className="text-text-secondary">Avoid:</span> {archiveReplay.avoid}
          </p>
        </div>
      ) : null}
      {captureSavedToast ? (
        <div className="fixed bottom-5 left-1/2 z-[120] -translate-x-1/2 rounded-full border border-cyan-300/35 bg-cyan-900/80 px-4 py-2 text-xs text-cyan-100">
          {captureSavedToast}
        </div>
      ) : null}
      {ritualToast ? (
        <div className="fixed top-20 left-1/2 z-[120] -translate-x-1/2 rounded-xl border border-cyan-300/35 bg-cyan-900/80 px-4 py-2 text-xs text-cyan-100">
          {ritualToast}
        </div>
      ) : null}
    </section>
  );
}
