const PERMISSION_KEY = "pojulife_syncro_permissions";
const COMPASS_GRANTED_FLAG = "pj_compass_granted";

export interface SyncroPermissions {
  orientation: boolean;
  camera: boolean;
  granted_at?: number;
}

const EMPTY: SyncroPermissions = { orientation: false, camera: false };

function parseStoredPermissions(raw: string | null): SyncroPermissions {
  if (!raw) return { ...EMPTY };
  try {
    const data = JSON.parse(raw) as Partial<SyncroPermissions>;
    return {
      orientation: !!data.orientation,
      camera: !!data.camera,
      granted_at: data.granted_at,
    };
  } catch {
    return { ...EMPTY };
  }
}

/** Synchronous read — use for initial React state (client only). */
export function readSyncroPermissionSync(): SyncroPermissions {
  if (typeof localStorage === "undefined") return { ...EMPTY };
  return parseStoredPermissions(localStorage.getItem(PERMISSION_KEY));
}

export async function loadSyncroPermission(): Promise<SyncroPermissions> {
  return readSyncroPermissionSync();
}

export async function saveSyncroPermission(
  type: "orientation" | "camera",
  granted: boolean,
): Promise<void> {
  if (typeof localStorage === "undefined") return;

  try {
    const current = readSyncroPermissionSync();
    const next: SyncroPermissions = {
      ...current,
      [type]: granted,
      granted_at: granted ? Date.now() : current.granted_at,
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
  const perms = readSyncroPermissionSync();
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

function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name ?? "";
  return name === "NotAllowedError" || name === "PermissionDeniedError";
}

/** If the browser already granted camera, mirror that into localStorage (PWA revisit). */
export async function syncCameraPermissionFromBrowser(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return readSyncroPermissionSync().camera;
  }

  try {
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    if (status.state === "granted") {
      await saveSyncroPermission("camera", true);
      return true;
    }
    if (status.state === "denied") {
      await saveSyncroPermission("camera", false);
      return false;
    }
  } catch {
    // permissions.query unsupported for camera on some WebKit builds
  }

  return readSyncroPermissionSync().camera;
}

/** Request camera for AR; stops tracks immediately after grant. Persists in localStorage. */
export async function requestSyncroCameraPermission(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }

  if (readSyncroPermissionSync().camera) {
    return true;
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
    if (isPermissionDeniedError(e)) {
      await saveSyncroPermission("camera", false);
    }
    return false;
  }
}

/** Start AR camera stream — no prompt if OS permission + local cache already granted. */
export async function acquireSyncroCameraStream(): Promise<MediaStream | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    await saveSyncroPermission("camera", true);
    return stream;
  } catch (e) {
    console.warn("[syncro] camera stream failed", e);
    if (isPermissionDeniedError(e)) {
      await saveSyncroPermission("camera", false);
    }
    return null;
  }
}
