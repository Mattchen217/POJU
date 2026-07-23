"use client";

import { clsx } from "clsx";

import "@/styles/wait-ritual.css";

type Props = {
  glowColor: string;
  /** Soft inset vignette — default on for Classic wait pages. */
  showBreath?: boolean;
  showFlash?: boolean;
  showConverge?: boolean;
};

export function WaitFxLayer({
  glowColor,
  showBreath = true,
  showFlash = false,
  showConverge = false,
}: Props) {
  return (
    <>
      {showBreath ? (
        <div
          className="wait-fx wait-fx--breath"
          style={{ ["--wait-glow" as string]: glowColor }}
          aria-hidden
        />
      ) : null}
      {showFlash ? (
        <div
          className="wait-fx wait-fx--flash"
          style={{ ["--wait-glow" as string]: glowColor }}
          aria-hidden
        />
      ) : null}
      {showConverge ? (
        <div
          className="wait-fx wait-fx--converge"
          style={{ ["--wait-glow" as string]: glowColor }}
          aria-hidden
        />
      ) : null}
    </>
  );
}

export function DeliveryWaitPageShell({
  exiting,
  className,
  children,
}: {
  exiting?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "delivery-wait-page preparing-spline-page preparing-spline-page--transition",
        exiting && "delivery-wait-page--exit",
        className,
      )}
    >
      {children}
    </div>
  );
}
