"use client";

import { useEffect, useRef, useState } from "react";
import { IconCamera, IconLoader2 } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { PostureHintOverlay } from "@/components/syncro/PostureHintOverlay";
import { SyncroModeFooter } from "@/components/syncro/SyncroModeFooter";
import { SyncroRingStage } from "@/components/syncro/SyncroRingStage";
import { WhyThisCurrentModal } from "@/components/syncro/WhyThisCurrentModal";
import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import {
  getCurrentLevelFallbackLabel,
  getCurrentLevelI18nKey,
} from "@/lib/syncro/compass-display";
import { compassDegreeToDirection, type CurrentLevel } from "@/lib/syncro/current-system";
import { isSyncroLlmReady } from "@/lib/syncro/llm-cell-display";
import { SYNCRO_AR_CAMERA_SIZE } from "@/lib/syncro/syncro-ring-layout";
import { matrixKey, type HourPeriod, type SyncroSession } from "@/lib/syncro/types";

import "@/styles/syncro-compass.css";

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
  const isZh = locale.startsWith("zh");

  const { compassDegree: alpha, deviceTiltBeta: beta } = useOrientation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  const direction = compassDegreeToDirection(alpha);
  const cellKey = matrixKey(hourPeriod, direction);
  const cell = session.matrix[cellKey];
  const llmHighlight = highlightMatrixKeys?.has(cellKey);
  const haloColor = HALO_COLORS[cell?.current_level ?? "stillwater"];

  const whyReady = Boolean(cell && isSyncroLlmReady(cell, session.llm_meta));
  const whyHasRationale = Boolean(cell?.rationale?.trim());
  const canOpenWhy = whyReady || whyHasRationale;

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
          video: { facingMode: "environment" },
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
          await video.play().catch(() => undefined);
          setStreamReady(true);
        }
      } catch (e) {
        console.error("[AR] camera failed:", e);
        setStreamReady(false);
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraGranted]);

  const levelKey = cell ? getCurrentLevelI18nKey(cell.current_level) : null;
  let levelTitle = "";
  if (cell && levelKey) {
    try {
      levelTitle = tLevels(levelKey);
    } catch {
      levelTitle = getCurrentLevelFallbackLabel(cell.current_level, isZh);
    }
  }

  if (!cameraGranted) {
    return (
      <div className="compass-page ar-mode-body">
        <PostureHintOverlay mode="ar" beta={beta} />
        <div style={{ textAlign: "center", marginTop: 120, padding: "0 24px" }}>
          <IconCamera aria-hidden size={32} stroke={1.5} style={{ color: "#D4A574" }} />
          <p style={{ marginTop: 16, fontSize: 13, color: "#A0A4B8" }}>{t("ar.permission_description")}</p>
          {onRequestCamera ? (
            <button type="button" className="why-btn-prominent" onClick={onRequestCamera}>
              {t("ar.permission_title")}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`compass-mode-body ar-mode-body ${llmHighlight ? "syncro-llm-cell-updated" : ""}`}>
      <PostureHintOverlay mode="ar" beta={beta} />

      <SyncroRingStage
        highlightId={direction}
        rotationDeg={alpha}
        center={
          <div
            className="syncro-ar-camera"
            style={{
              width: SYNCRO_AR_CAMERA_SIZE,
              height: SYNCRO_AR_CAMERA_SIZE,
              boxShadow: `0 0 32px ${haloColor}, 0 0 64px ${haloColor.replace(/0\.\d+/, "0.25")}, inset 0 0 0 2px ${haloColor}`,
            }}
          >
            <video ref={videoRef} playsInline muted autoPlay />
            {!streamReady ? (
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
              <div className="syncro-ar-camera-level">
                <div
                  className="compass-center-level"
                  style={{ color: LEVEL_COLORS[cell.current_level] }}
                >
                  {levelTitle}
                </div>
              </div>
            ) : null}
          </div>
        }
      />

      <SyncroModeFooter
        cell={cell}
        llmMeta={session.llm_meta}
        canOpenWhy={canOpenWhy}
        onWhyClick={() => setWhyOpen(true)}
      />

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
