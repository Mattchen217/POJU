"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  DELIVERY_WAIT_SCENES,
  WAIT_BAZI_CACHED_MIN_MS,
  WAIT_BRIDGE_HOLD_MS,
  WAIT_CONVERGE_MS,
  WAIT_CROSSFADE_MS,
  WAIT_FLASH_MS,
  WAIT_STEP_INTERVAL_MS,
  glowForPhase,
  productScene,
  type DeliveryWaitProduct,
  type DeliveryWaitVisualPhase,
} from "@/lib/wait-ritual/constants";

export type UseDeliveryWaitPhaseOptions = {
  product: DeliveryWaitProduct;
  /** Syncro default: skip bazi P1 */
  skipBazi?: boolean;
  /** Cached profile — enforce 10s bazi display without LLM */
  isReturningUser?: boolean;
  /** Depth-① stream finished (or returning user timer elapsed) */
  baziComplete: boolean;
  /** Depth-② finished */
  productComplete: boolean;
  enabled?: boolean;
  onExitComplete?: () => void;
};

export type DeliveryWaitPhaseState = {
  phase: DeliveryWaitVisualPhase;
  scene: string;
  glowColor: string;
  stepIndex: number;
  showFlash: boolean;
  showConverge: boolean;
  exiting: boolean;
  copyPhase: "bazi" | "bridge" | "glyph" | "match" | "syncro";
};

export function useDeliveryWaitPhase(opts: UseDeliveryWaitPhaseOptions): DeliveryWaitPhaseState {
  const {
    product,
    skipBazi = product === "syncro",
    isReturningUser = false,
    baziComplete,
    productComplete,
    enabled = true,
    onExitComplete,
  } = opts;

  const [phase, setPhase] = useState<DeliveryWaitVisualPhase>(() =>
    skipBazi || product === "poju" ? (product === "poju" ? "bazi" : "product") : "bazi",
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [showConverge, setShowConverge] = useState(false);
  const [exiting, setExiting] = useState(false);
  const baziMinMetRef = useRef(!isReturningUser || skipBazi);
  const exitCalledRef = useRef(false);
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;

  useEffect(() => {
    if (!enabled || !isReturningUser || skipBazi) return;
    baziMinMetRef.current = false;
    const timer = window.setTimeout(() => {
      baziMinMetRef.current = true;
    }, WAIT_BAZI_CACHED_MIN_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, isReturningUser, skipBazi]);

  useEffect(() => {
    if (!enabled || phase !== "bazi") return;
    if (!baziComplete || !baziMinMetRef.current) return;

    if (product === "poju") {
      setPhase("converge");
      setShowConverge(true);
      return;
    }

    setPhase("bridge");
    setStepIndex(0);
    const bridgeTimer = window.setTimeout(() => {
      setShowFlash(true);
      window.setTimeout(() => setShowFlash(false), WAIT_FLASH_MS);
      setPhase("product");
      setStepIndex(0);
    }, WAIT_BRIDGE_HOLD_MS);
    return () => window.clearTimeout(bridgeTimer);
  }, [enabled, phase, baziComplete, product]);

  useEffect(() => {
    if (!enabled || phase !== "product") return;
    if (!productComplete) return;
    setPhase("converge");
    setShowConverge(true);
  }, [enabled, phase, productComplete]);

  useEffect(() => {
    if (!enabled || phase !== "converge" || !showConverge) return;
    const timer = window.setTimeout(() => {
      setExiting(true);
    }, WAIT_CONVERGE_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, phase, showConverge]);

  useEffect(() => {
    if (!enabled || !exiting || exitCalledRef.current) return;
    const timer = window.setTimeout(() => {
      exitCalledRef.current = true;
      onExitCompleteRef.current?.();
    }, WAIT_CROSSFADE_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, exiting]);

  useEffect(() => {
    if (!enabled) return;
    if (phase !== "bazi" && phase !== "product") return;
    const interval = window.setInterval(() => {
      setStepIndex((i) => i + 1);
    }, WAIT_STEP_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [enabled, phase]);

  const scene = useMemo(() => {
    if (phase === "bazi" || phase === "bridge") return DELIVERY_WAIT_SCENES.bazi;
    if (product === "poju") return DELIVERY_WAIT_SCENES.bazi;
    return productScene(product);
  }, [phase, product]);

  const copyPhase = useMemo((): DeliveryWaitPhaseState["copyPhase"] => {
    if (phase === "bridge") {
      return product === "match" ? "match" : product === "glyph" ? "glyph" : "syncro";
    }
    if (phase === "bazi") return "bazi";
    if (product === "poju") return "bazi";
    return product;
  }, [phase, product]);

  return {
    phase,
    scene,
    glowColor: glowForPhase(product, phase),
    stepIndex,
    showFlash,
    showConverge,
    exiting,
    copyPhase,
  };
}
