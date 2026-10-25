export type PostureMode = "compass" | "ar";

/** Whether device tilt matches the active Syncro mode (beta from DeviceOrientationEvent). */
export function checkPosture(mode: PostureMode, beta: number | null): boolean {
  if (beta == null || Number.isNaN(beta)) {
    return false;
  }

  if (mode === "compass") {
    return Math.abs(beta) < 30;
  }

  return beta > 50 && beta < 130;
}
