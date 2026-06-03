"use client";

import { useEffect, useRef, useState } from "react";
import { IconCamera, IconLoader2 } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { PostureHintOverlay } from "@/components/syncro/PostureHintOverlay";
import { SyncroCellAdvice } from "@/components/syncro/SyncroCellAdvice";
import { SyncroDirectionLabels } from "@/components/syncro/SyncroDirectionLabels";
import { SyncroParticleCore } from "@/components/syncro/SyncroParticleCore";
import { WhyThisCurrentModal } from "@/components/syncro/WhyThisCurrentModal";
import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import {
  getCurrentLevelFallbackLabel,
  getCurrentLevelI18nKey,
} from "@/lib/syncro/compass-display";
import { compassDegreeToDirection, type CurrentLevel } from "@/lib/syncro/current-system";
import { isSyncroLlmReady } from "@/lib/syncro/llm-cell-display";
import {
  SYNCRO_PARTICLE_DISPLAY_SIZE,
  SYNCRO_RING_MARGIN_TOP,
  SYNCRO_RING_SIZE,
  SYNCRO_WHY_BUTTON_MARGIN_TOP,
} from "@/lib/syncro/syncro-ring-layout";
import {
  acquireSyncroCameraStream,
  readSyncroPermissionSync,
} from "@/lib/syncro/permissions";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-compass.css";
import "@/styles/syncro-ar.css";

/** AR-only layout — compass / map use shared ring-layout constants. */
const SYNCRO_AR_CAMERA_VIEW_SIZE = 228;
const SYNCRO_AR_PARTICLE_CLIP_SIZE = SYNCRO_PARTICLE_DISPLAY_SIZE;

const HALO_COLORS: Record<CurrentLevel, string> = {
  open_current: "rgba(0, 217, 184, 0.7)",
  following_current: "rgba(78, 205, 196, 0.6)",
  stillwater: "rgba(138, 138, 160, 0.4)",
  crosscurrent: "rgba(232, 159, 77, 0.6)",
  undertow: "rgba(200, 90, 90, 0.6)",
};

const LEVEL_COLORS: Record<CurrentLevel, string> = {
  open_current: "#00D9B8",
  following_current: "#4ECDC4",
  stillwater: "#8A8AA0",
  crosscurrent: "#E89F4D",
  undertow: "#C85A5A",
};

export type SyncroARModeProps = {
  session: SyncroSession;
  locale: string;
  hourPeriod: HourPeriod;
  highlightMatrixKeys?: Set<string>;
  cameraGranted?: boolean;
  onRequestCamera?: () => void;
  marketingPreview?: boolean;
};

export function SyncroARMode({
  session,
  locale,
  hourPeriod,
  highlightMatrixKeys,
  cameraGranted = false,
  onRequestCamera,
  marketingPreview = false,
}: SyncroARModeProps) {
  const t = useTranslations("syncro");
  const tLevels = useTranslations("syncro.levels");
  const isZh = locale.startsWith("zh");

  const { compassDegree: alpha, deviceTiltBeta: beta } = useOrientation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [cachedCameraGranted, setCachedCameraGranted] = useState(
    () => cameraGranted || readSyncroPermissionSync().camera,
  );

  const effectiveCameraGranted = marketingPreview || cameraGranted || cachedCameraGranted;

  useEffect(() => {
    if (cameraGranted) setCachedCameraGranted(true);
  }, [cameraGranted]);

  useEffect(() => {
    if (readSyncroPermissionSync().camera) {
      setCachedCameraGranted(true);
    }
  }, []);

  const direction = compassDegreeToDirection(alpha);
  const cellKey = matrixKey(hourPeriod, direction);
  const cell = session.matrix[cellKey];
  const llmHighlight = highlightMatrixKeys?.has(cellKey);
  const haloColor = HALO_COLORS[cell?.current_level ?? "stillwater"];
  const whyReady = Boolean(cell && isSyncroLlmReady(cell, session.llm_meta));
  const whyHasRationale = Boolean(cell?.rationale?.trim());
  const canOpenWhy = whyReady || whyHasRationale;

  useEffect(() => {
    if (marketingPreview) return;
    if (!effectiveCameraGranted) {
      setStreamReady(false);
      return;
    }

    let cancelled = false;

    async function startCamera() {
      const stream = await acquireSyncroCameraStream();
      if (!stream) {
        setCachedCameraGranted(false);
        setStreamReady(false);
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setCachedCameraGranted(true);
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        setStreamReady(true);
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [effectiveCameraGranted, marketingPreview]);

  const levelKey = cell ? getCurrentLevelI18nKey(cell.current_level) : null;
  let levelTitle = "";
  if (cell && levelKey) {
    try {
      levelTitle = tLevels(levelKey);
    } catch {
      levelTitle = getCurrentLevelFallbackLabel(cell.current_level, isZh);
    }
  }

  if (!effectiveCameraGranted && !marketingPreview) {
    return (
      <div className="compass-page">
        <PostureHintOverlay mode="ar" beta={beta} />
        <div style={{ textAlign: "center", marginTop: 120, padding: "0 24px" }}>
          <IconCamera aria-hidden size={32} stroke={1.5} style={{ color: "#D4A574" }} />
          <p style={{ marginTop: 16, fontSize: 13, color: "#A0A4B8" }}>{t("ar.permission_description")}</p>
          {onRequestCamera ? (
            <button
              type="button"
              onClick={onRequestCamera}
              style={{
                marginTop: 16,
                padding: "8px 18px",
                background: "rgba(212, 165, 116, 0.12)",
                color: "#D4A574",
                fontSize: 11,
                border: "none",
                borderRadius: 20,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t("ar.permission_title")}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`compass-page ${llmHighlight ? "syncro-llm-cell-updated" : ""}`}>
      {!marketingPreview ? <PostureHintOverlay mode="ar" beta={beta} /> : null}

      <div
        className={`syncro-ar-ring${marketingPreview ? " syncro-marketing-ring-shell" : ""}`}
        style={{
          position: "relative",
          width: SYNCRO_RING_SIZE,
          height: SYNCRO_RING_SIZE,
          margin: `${SYNCRO_RING_MARGIN_TOP}px auto 0`,
          overflow: "visible",
          ["--ar-particle-clip-size" as string]: `${SYNCRO_AR_PARTICLE_CLIP_SIZE}px`,
          ["--ar-camera-size" as string]: `${SYNCRO_AR_CAMERA_VIEW_SIZE}px`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            transform: `rotate(${-alpha}deg)`,
            transformOrigin: "center center",
          }}
        >
          <div className="ar-particle-clip" aria-hidden>
            <SyncroParticleCore bare />
          </div>

          <SyncroDirectionLabels highlightId={direction} counterRotateDeg={alpha} />
        </div>

        <div
          className="ar-camera-hub"
          style={{
            boxShadow: `0 0 32px ${haloColor}, 0 0 64px ${haloColor.replace(/0\.\d+/, "0.25")}, inset 0 0 0 2px ${haloColor}`,
            transition: "box-shadow 600ms ease",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{ width: "100%", height: "100%", objectFit: "cover", display: marketingPreview ? "none" : "block" }}
          />
          {marketingPreview ? (
            <div className="syncro-ar-marketing-placeholder" aria-hidden />
          ) : null}
          {!marketingPreview && !streamReady ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(7,9,26,0.6)",
              }}
            >
              <IconLoader2 aria-hidden size={20} stroke={1.5} className="syncro-advice-spin" />
            </div>
          ) : null}

          {cell ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "radial-gradient(circle, rgba(7,9,26,0.5) 0%, transparent 70%)",
                color: "#fff",
                textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                pointerEvents: "none",
              }}
            >
              <div
                className="syncro-center-level-title"
                style={{ color: LEVEL_COLORS[cell.current_level] }}
              >
                {levelTitle}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {cell ? (
        <div
          className={marketingPreview ? "syncro-marketing-advice-block" : undefined}
          style={{ maxWidth: 320, margin: "24px auto 0", padding: "0 20px" }}
        >
          <SyncroCellAdvice
            cell={cell}
            llmMeta={session.llm_meta}
            className="compass-short-advice ar-short-advice"
          />
        </div>
      ) : null}

      <div
        className={marketingPreview ? "syncro-marketing-why-block" : undefined}
        style={{ textAlign: "center", marginTop: SYNCRO_WHY_BUTTON_MARGIN_TOP }}
      >
        <button
          type="button"
          className="why-btn-prominent"
          disabled={!cell || !canOpenWhy}
          onClick={() => {
            if (cell && canOpenWhy) setWhyOpen(true);
          }}
          style={
            marketingPreview
              ? undefined
              : {
                  padding: "8px 18px",
                  background: "rgba(212, 165, 116, 0.12)",
                  color: "#D4A574",
                  fontSize: 11,
                  fontWeight: 500,
                  border: "none",
                  borderRadius: 20,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }
          }
        >
          {t("why_this_current")}
        </button>
      </div>

      {whyOpen && cell && canOpenWhy ? (
        <WhyThisCurrentModal
          cell={cell}
          direction={direction}
          hourId={hourPeriod}
          onClose={() => setWhyOpen(false)}
        />
      ) : null}
    </div>
  );
}
