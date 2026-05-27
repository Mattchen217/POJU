"use client";

import { useEffect, useRef, useState } from "react";
import { IconCamera, IconLoader2 } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";

import { WhyThisCurrentModal } from "@/components/syncro/WhyThisCurrentModal";
import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import {
  getCurrentLevelFallbackLabel,
  getCurrentLevelI18nKey,
} from "@/lib/syncro/compass-display";
import {
  compassDegreeToDirection,
  currentLevelCssClass,
  DIRECTIONS,
  type DirectionId,
} from "@/lib/syncro/current-system";
import { HOUR_PERIOD_RANGES, hourPeriodDisplayName } from "@/lib/syncro/hour-period-ranges";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-ar.css";

export type SyncroARModeProps = {
  session: SyncroSession;
  locale: string;
  hourPeriod: HourPeriod;
  highlightMatrixKeys?: Set<string>;
  cameraGranted?: boolean;
  onRequestCamera?: () => void;
};

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

  if (!cell) {
    return (
      <div className="ar-loading" aria-busy="true">
        <IconLoader2 aria-hidden size={28} stroke={1.5} className="ar-loading-spin" />
      </div>
    );
  }

  const levelKey = getCurrentLevelI18nKey(cell.current_level);
  let levelTitle: string;
  try {
    levelTitle = tLevels(levelKey);
  } catch {
    levelTitle = getCurrentLevelFallbackLabel(cell.current_level, isZh);
  }

  const dirInfo = DIRECTIONS[currentDirection];

  return (
    <div className={`ar-mode ${llmHighlight ? "syncro-llm-cell-updated" : ""}`}>
      <div className="ar-camera-section">
        <video
          ref={videoRef}
          className="ar-video"
          playsInline
          muted
          autoPlay
          aria-label={t("ar.video_label")}
        />
        {!streamReady ? <div className="ar-video-placeholder" aria-hidden /> : null}

        <div className="ar-particles" aria-hidden>
          <div
            className="ar-particle-ring"
            style={{ transform: `translate(-50%, -50%) rotate(${-compassDegree}deg)` }}
          />
        </div>

        <div className="ar-direction-badge">{currentDirection}</div>
      </div>

      <div className="ar-content-section">
        <div className={`current-level ${currentLevelCssClass(cell.current_level)}`}>{levelTitle}</div>

        <div className="cell-meta">
          <span>{isZh ? dirInfo.name_zh : dirInfo.name_en}</span>
          <span className="meta-divider">·</span>
          <span>
            {hourPeriodDisplayName(hourPeriod, resolvedLocale)} · {HOUR_PERIOD_RANGES[hourPeriod]}
          </span>
        </div>

        <p className="short-advice">{cell.short_advice}</p>

        <button type="button" className="why-btn" onClick={() => setWhyModalOpen(true)}>
          {t("why_this_current")}
        </button>
      </div>

      {whyModalOpen ? (
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
