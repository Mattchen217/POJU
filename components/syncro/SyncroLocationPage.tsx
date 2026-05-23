"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

type LocationStage = "asking" | "granted" | "denied";

export function SyncroLocationPage() {
  const router = useRouter();
  const t = useTranslations("syncro.location");

  const [stage, setStage] = useState<LocationStage>("asking");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const profileId = sessionStorage.getItem("syncro_profile_id");
    if (!profileId) {
      router.replace("/syncro/prepare");
    }
  }, [router]);

  function requestLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation not supported on this device");
      setStage("denied");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        setStage("granted");
        sessionStorage.setItem("syncro_location", JSON.stringify({ lat, lng }));

        window.setTimeout(() => {
          router.push("/syncro/computing");
        }, 1500);
      },
      (err) => {
        setError(err.message);
        setStage("denied");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }

  function handleRetry() {
    setStage("asking");
    setError(null);
  }

  return (
    <main className="syncro-location-page flex min-h-screen flex-col items-center justify-center bg-bg-deep px-4 py-12 text-text-body">
      {stage === "asking" ? <AskingView onAllow={requestLocation} /> : null}
      {stage === "granted" && coords ? <GrantedView coords={coords} /> : null}
      {stage === "denied" ? <DeniedView error={error} onRetry={handleRetry} onAllow={requestLocation} /> : null}
    </main>
  );
}

function AskingView({ onAllow }: { onAllow: () => void }) {
  const t = useTranslations("syncro.location");

  return (
    <div className="location-asking max-w-md text-center">
      <div className="location-icon text-5xl" aria-hidden>
        📍
      </div>
      <h2 className="mt-6 text-xl font-semibold text-text-primary">{t("asking_title")}</h2>
      <p className="mt-4 text-[15px] leading-8 text-text-secondary">{t("asking_message")}</p>
      <p className="hint mt-3 text-sm text-text-dim">{t("asking_privacy")}</p>
      <button
        type="button"
        onClick={onAllow}
        className="marketing-pill-outline-cta marketing-pill-outline-cta--cyan mt-10 inline-flex w-full max-w-sm justify-center px-8 py-3.5 text-[15px] font-semibold"
      >
        {t("allow_location")}
      </button>
    </div>
  );
}

function GrantedView({ coords }: { coords: { lat: number; lng: number } }) {
  const t = useTranslations("syncro.location");

  return (
    <div className="location-granted max-w-md text-center">
      <div className="success-icon text-4xl text-cyan-300" aria-hidden>
        ✓
      </div>
      <p className="mt-6 text-[15px] leading-8 text-text-secondary">{t("granted_message")}</p>
      <p className="coords mt-2 font-mono text-sm text-text-dim">
        {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
      </p>
      <div
        className="loading-spinner-small mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300"
        aria-hidden
      />
    </div>
  );
}

function DeniedView({
  error,
  onRetry,
  onAllow,
}: {
  error: string | null;
  onRetry: () => void;
  onAllow: () => void;
}) {
  const t = useTranslations("syncro.location");

  return (
    <div className="location-denied max-w-md text-center">
      <div className="error-icon text-4xl text-red-300/90" aria-hidden>
        ✕
      </div>
      <h2 className="mt-6 text-xl font-semibold text-text-primary">{t("denied_title")}</h2>
      <p className="mt-4 text-[15px] leading-8 text-text-secondary">{t("denied_message")}</p>
      {error ? <p className="error-detail mt-2 text-sm text-text-dim">{error}</p> : null}
      <button
        type="button"
        onClick={() => {
          onRetry();
          onAllow();
        }}
        className="marketing-pill-outline-cta marketing-pill-outline-cta--cyan mt-10 inline-flex justify-center px-8 py-3 text-sm font-semibold"
      >
        {t("retry")}
      </button>
    </div>
  );
}
