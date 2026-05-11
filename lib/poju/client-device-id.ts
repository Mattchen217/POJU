const DEVICE_KEY = "pojulife_device_id_v4";

/** 与聊天页、POJU 入口共用的设备 ID（用于服务端 active session 去重）。 */
export function getPojuDeviceId(): string {
  if (typeof window === "undefined") return "device_local";
  const hit = localStorage.getItem(DEVICE_KEY);
  if (hit) return hit;
  const next = `dev_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  localStorage.setItem(DEVICE_KEY, next);
  return next;
}
