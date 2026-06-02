const PERMISSION_KEY = "pojulife_syncro_permissions";
const COMPASS_GRANTED_FLAG = "pj_compass_granted";

export interface SyncroPermissions {
  orientation: boolean;
  camera: boolean;
  granted_at?: number;
}

export async function loadSyncroPermission(): Promise<SyncroPermissions> {
  if (typeof localStorage === "undefined") {
    return { orientation: false, camera: false };
  }

  try {
    const raw = localStorage.getItem(PERMISSION_KEY);
    if (!raw) return { orientation: false, camera: false };

    const data = JSON.parse(raw) as Partial<SyncroPermissions>;
    return {
      orientation: !!data.orientation,
      camera: !!data.camera,
      granted_at: data.granted_at,
    };
  } catch {
    return { orientation: false, camera: false };
  }
}

export async function saveSyncroPermission(
  type: "orientation" | "camera",
  granted: boolean,
): Promise<void> {
  if (typeof localStorage === "undefined") return;

  try {
    const current = await loadSyncroPermission();
    const next: SyncroPermissions = {
      ...current,
      [type]: granted,
      granted_at: Date.now(),
    };
    localStorage.setItem(PERMISSION_KEY, JSON.stringify(next));
  } catch (e) {
    console.error("[syncro] save permission failed", e);
  }
}

export type SyncroPermissionStatus = {
  orientation: boolean;
  camera: boolean;
  /** Both compass + camera were granted at least once on this device. */
  allGranted: boolean;
};

export async function getSyncroPermissionStatus(): Promise<SyncroPermissionStatus> {
  const perms = await loadSyncroPermission();
  const compassFlag =
    typeof localStorage !== "undefined" && localStorage.getItem(COMPASS_GRANTED_FLAG) === "1";
  const orientation = perms.orientation || compassFlag;
  const camera = perms.camera;
  return {
    orientation,
    camera,
    allGranted: orientation && camera,
  };
}

/** Request camera for AR; stops tracks immediately after grant. */
export async function requestSyncroCameraPermission(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    await saveSyncroPermission("camera", false);
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    stream.getTracks().forEach((track) => track.stop());
    await saveSyncroPermission("camera", true);
    return true;
  } catch (e) {
    console.warn("[syncro] camera permission denied", e);
    await saveSyncroPermission("camera", false);
    return false;
  }
}
