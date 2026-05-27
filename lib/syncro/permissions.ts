const PERMISSION_KEY = "pojulife_syncro_permissions";

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
