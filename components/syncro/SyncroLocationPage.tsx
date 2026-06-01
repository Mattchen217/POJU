"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { CitySearchBox, type CitySearchSelection } from "@/components/syncro/CitySearchBox";
import { useRouter } from "@/i18n/navigation";
import {
  deviceOrientationRequiresPermissionPrompt,
  markCompassGrantedInStorage,
  requestDeviceOrientationPermission,
} from "@/lib/syncro/compass-permission-ios";
import {
  SYNCRO_LOCATION_STORAGE_KEY,
  buildSyncroStoredLocation,
  type SyncroStoredLocation,
} from "@/lib/syncro/syncro-location-storage";

type LocationStage = "asking" | "manual_search" | "confirm" | "denied";

export function SyncroLocationPage() {
  const router = useRouter();

  const [stage, setStage] = useState<LocationStage>("asking");
  const [location, setLocation] = useState<SyncroStoredLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const geoStartedRef = useRef(false);

  useEffect(() => {
    const profileId = sessionStorage.getItem("syncro_profile_id");
    if (!profileId) {
      router.replace("/syncro/prepare");
    }
  }, [router]);

  useEffect(() => {
    if (geoStartedRef.current) return;
    geoStartedRef.current = true;
    tryGeolocation();
  }, []);

  function tryGeolocation() {
    setError(null);

    if (!navigator.geolocation) {
      setStage("manual_search");
      return;
    }

    setStage("asking");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(
          buildSyncroStoredLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: "geolocation",
          }),
        );
        setStage("confirm");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStage("manual_search");
        } else {
          setError(err.message);
          setStage("denied");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }

  function handleManualSelect(city: CitySearchSelection) {
    setLocation(
      buildSyncroStoredLocation({
        lat: city.lat,
        lng: city.lng,
        source: "manual",
        city_name: city.name,
      }),
    );
    setStage("confirm");
  }

  function handleConfirm() {
    if (!location) return;
    sessionStorage.setItem(SYNCRO_LOCATION_STORAGE_KEY, JSON.stringify(location));

    const goComputing = () => router.push("/syncro/computing");

    if (deviceOrientationRequiresPermissionPrompt()) {
      requestDeviceOrientationPermission().then((status) => {
        if (status === "granted") {
          void markCompassGrantedInStorage();
        }
        goComputing();
      });
      return;
    }

    goComputing();
  }

  return (
    <main className="syncro-location-page flex min-h-screen flex-col items-center justify-center bg-bg-deep px-4 py-12 text-text-body">
      {stage === "asking" ? <AskingView /> : null}
      {stage === "manual_search" ? (
        <ManualSearchView onSelect={handleManualSelect} onRetry={tryGeolocation} />
      ) : null}
      {stage === "confirm" && location ? (
        <ConfirmView
          location={location}
          onConfirm={handleConfirm}
          onChangeLocation={() => setStage("manual_search")}
        />
      ) : null}
      {stage === "denied" ? (
        <DeniedView
          error={error}
          onRetry={tryGeolocation}
          onManual={() => setStage("manual_search")}
        />
      ) : null}
    </main>
  );
}

function AskingView() {
  const t = useTranslations("syncro.location");

  return (
    <div className="location-asking max-w-md text-center">
      <div
        className="loading-spinner mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300"
        aria-hidden
      />
      <h2 className="mt-6 text-xl font-semibold text-text-primary">{t("asking_title")}</h2>
      <p className="mt-4 text-[15px] leading-8 text-text-secondary">{t("asking_message")}</p>
      <p className="hint mt-3 text-sm text-text-dim">{t("asking_privacy")}</p>
    </div>
  );
}

function ManualSearchView({
  onSelect,
  onRetry,
}: {
  onSelect: (city: CitySearchSelection) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("syncro.location");

  return (
    <div className="location-manual w-full max-w-md text-center">
      <h2 className="text-xl font-semibold text-text-primary">{t("manual_title")}</h2>
      <p className="mt-4 text-[15px] leading-8 text-text-secondary">{t("manual_description")}</p>
      <CitySearchBox onSelect={onSelect} />
      <button
        type="button"
        onClick={onRetry}
        className="text-button mt-8 text-sm text-cyan-200 underline underline-offset-4 hover:text-cyan-100"
      >
        {t("retry_geolocation")}
      </button>
    </div>
  );
}

function ConfirmView({
  location,
  onConfirm,
  onChangeLocation,
}: {
  location: SyncroStoredLocation;
  onConfirm: () => void;
  onChangeLocation: () => void;
}) {
  const t = useTranslations("syncro.location");

  return (
    <div className="location-confirm max-w-md text-center">
      <div className="success-icon text-5xl" aria-hidden>
        📍
      </div>
      <h2 className="mt-6 text-xl font-semibold text-text-primary">{t("confirm_title")}</h2>
      {location.city_name ? (
        <p className="city mt-3 text-[15px] leading-7 text-text-secondary">{location.city_name}</p>
      ) : (
        <p className="coords mt-3 font-mono text-sm text-text-dim">
          {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
        </p>
      )}
      {location.accuracy != null && location.accuracy > 1000 ? (
        <p className="accuracy-warning mt-4 text-sm text-amber-200/90">
          {t("accuracy_warning", { meters: Math.round(location.accuracy) })}
        </p>
      ) : null}
      <p className="hint mt-4 text-sm text-text-dim">{t("confirm_hint")}</p>
      <button
        type="button"
        onClick={onConfirm}
        className="marketing-pill-outline-cta marketing-pill-outline-cta--cyan mt-10 inline-flex w-full max-w-sm justify-center px-8 py-3.5 text-[15px] font-semibold"
      >
        {t("confirm_use")}
      </button>
      <button
        type="button"
        onClick={onChangeLocation}
        className="text-button mt-6 text-sm text-cyan-200 underline underline-offset-4 hover:text-cyan-100"
      >
        {t("change_location")}
      </button>
    </div>
  );
}

function DeniedView({
  error,
  onRetry,
  onManual,
}: {
  error: string | null;
  onRetry: () => void;
  onManual: () => void;
}) {
  const t = useTranslations("syncro.location");

  return (
    <div className="location-denied max-w-md text-center">
      <div className="error-icon text-4xl" aria-hidden>
        ⚠️
      </div>
      <h2 className="mt-6 text-xl font-semibold text-text-primary">{t("denied_title")}</h2>
      <p className="mt-4 text-[15px] leading-8 text-text-secondary">{t("denied_message")}</p>
      {error ? <p className="error-detail mt-2 text-sm text-text-dim">{error}</p> : null}
      <button
        type="button"
        onClick={onRetry}
        className="marketing-pill-outline-cta marketing-pill-outline-cta--cyan mt-10 inline-flex justify-center px-8 py-3 text-sm font-semibold"
      >
        {t("retry")}
      </button>
      <button
        type="button"
        onClick={onManual}
        className="text-button mt-6 block w-full text-sm text-cyan-200 underline underline-offset-4 hover:text-cyan-100"
      >
        {t("search_manually")}
      </button>
    </div>
  );
}
