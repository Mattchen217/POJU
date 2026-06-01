"use client";

import { useEffect, useRef, useState } from "react";
import { IconCamera, IconDeviceMobile, IconLoader2 } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";

import { SyncroDirectionRing } from "@/components/syncro/SyncroDirectionRing";
import { SyncroParticleCore } from "@/components/syncro/SyncroParticleCore";
import { WhyThisCurrentModal } from "@/components/syncro/WhyThisCurrentModal";
import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import { getArHaloColors } from "@/lib/syncro/ar-halo-colors";
import {
  getCurrentLevelFallbackLabel,
  getCurrentLevelI18nKey,
} from "@/lib/syncro/compass-display";
import {
  compassDegreeToDirection,
  currentLevelCssClass,
  type DirectionId,
} from "@/lib/syncro/current-system";
import { HOUR_PERIOD_RANGES, hourPeriodDisplayName } from "@/lib/syncro/hour-period-ranges";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-compass.css";
import "@/styles/syncro-ar.css";

export type SyncroARModeProps = {
  session: SyncroSession;
  locale: string;
  hourPeriod: HourPeriod;
  highlightMatrixKeys?: Set<string>;
  cameraGranted?: boolean;
  onRequestCamera?: () => void;
};

function UprightPhoneHint() {
  const t = useTranslations("syncro.ar");
  return (
    <div className="phone-position-hint ar-phone-hint">
      <IconDeviceMobile aria-hidden size={14} stroke={1.75} className="phone-position-hint-icon" />
      <span>{t("hold_phone_upright")}</span>
    </div>
  );
}

export function SyncroARMode({
  session,
  locale,
  hourPeriod,
  highlightMatrixKeys,
  cameraGranted = false,
  onRequestCamera,
}: SyncroARModeProps) {
  const t = useTranslations("syncro");
  const tLevels = useTranslations("syncro.levels");
  const resolvedLocale = useLocale();
  const isZh = locale.startsWith("zh");

  const { compassDegree } = useOrientation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [whyModalOpen, setWhyModalOpen] = useState(false);

  const currentDirection: DirectionId = compassDegreeToDirection(compassDegree);
  const cellKey = matrixKey(hourPeriod, currentDirection);
  const cell = session.matrix[cellKey];
  const llmHighlight = highlightMatrixKeys?.has(cellKey);

  useEffect(() => {
    if (!cameraGranted) {
      setStreamReady(false);
      return;
    }

    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {
            /* autoplay policy */
          });
          setStreamReady(true);
        }
      } catch (e) {
        console.error("[syncro/ar] camera start failed", e);
        setStreamReady(false);
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStreamReady(false);
    };
  }, [cameraGranted]);

  if (!cameraGranted) {
    return (
      <div className="ar-permission-needed">
        <div className="permission-icon">
          <IconCamera aria-hidden size={32} stroke={1.5} />
        </div>
        <h3>{t("ar.permission_title")}</h3>
        <p>{t("ar.permission_description")}</p>
        <button type="button" className="permission-btn" onClick={onRequestCamera}>
          {t("ar.grant_access")}
        </button>
      </div>
    );
  }

  const halo = getArHaloColors(cell?.current_level);
  const haloStyle = {
    boxShadow: `0 0 32px ${halo.glow1}, 0 0 64px ${halo.glow2}, inset 0 0 0 2px ${halo.border}`,
  } as const;

  let levelTitle = "";
  if (cell) {
    const levelKey = getCurrentLevelI18nKey(cell.current_level);
    try {
      levelTitle = tLevels(levelKey);
    } catch {
      levelTitle = getCurrentLevelFallbackLabel(cell.current_level, isZh);
    }
  }

  return (
    <div className={`syncro-immersive ar-mode ${llmHighlight ? "syncro-llm-cell-updated" : ""}`}>
      <UprightPhoneHint />

      <div className="syncro-content-overlay ar-mode-body">
        <div className="concentric-system">
          <div
            className="rotating-layer"
            style={{
              transform: `rotate(${-compassDegree}deg)`,
              transition: "transform 200ms ease-out",
            }}
          >
            <SyncroParticleCore />
            <SyncroDirectionRing activeDirection={currentDirection} />
          </div>

          <div className="ar-window-layer">
            <div className="ar-camera-window" style={haloStyle}>
              <video
                ref={videoRef}
                className="ar-video"
                playsInline
                muted
                autoPlay
                aria-label={t("ar.video_label")}
              />
              {!streamReady ? <div className="ar-video-placeholder" aria-hidden /> : null}

              {cell ? (
                <div className="ar-info-overlay">
                  <div className={`ar-level ${currentLevelCssClass(cell.current_level)}`}>
                    {levelTitle}
                  </div>
                  <div className="ar-meta">
                    <span>{currentDirection}</span>
                    <span className="meta-divider">·</span>
                    <span>
                      {hourPeriodDisplayName(hourPeriod, resolvedLocale)} ·{" "}
                      {HOUR_PERIOD_RANGES[hourPeriod]}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="ar-info-overlay ar-info-overlay--loading" aria-busy="true">
                  <IconLoader2 aria-hidden size={20} stroke={1.5} className="ar-loading-spin" />
                  <span>{t("generating")}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {cell ? (
          <>
            <p className="compass-short-advice ar-short-advice">{cell.short_advice}</p>
            <div className="compass-bottom-cta">
              <button type="button" className="why-btn-prominent" onClick={() => setWhyModalOpen(true)}>
                {t("why_this_current")}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {whyModalOpen && cell ? (
        <WhyThisCurrentModal
          cell={cell}
          direction={currentDirection}
          hourId={hourPeriod}
          onClose={() => setWhyModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
