/**
 * Host-relative path to the APK shipped in `public/downloads/`.
 * Override with NEXT_PUBLIC_ANDROID_APK_URL for an absolute CDN URL if needed.
 */
export const DEFAULT_ANDROID_APK_PATH = "/downloads/Pojulife.apk";

export function getPublicAndroidApkUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_ANDROID_APK_PATH;
}
