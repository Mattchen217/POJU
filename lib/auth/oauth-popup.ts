/**
 * Desktop OAuth via popup so the main Eastern OS tab never leaves
 * if the IdP (X/Google/…) shows an error page.
 */

export const OAUTH_POPUP_MESSAGE_TYPE = "easternos-oauth-done" as const;

export type OAuthPopupMessage = {
  type: typeof OAUTH_POPUP_MESSAGE_TYPE;
  status: "ok" | "error";
  next?: string;
};

export function isOAuthPopupMessage(data: unknown): data is OAuthPopupMessage {
  if (!data || typeof data !== "object") return false;
  const row = data as Record<string, unknown>;
  return (
    row.type === OAUTH_POPUP_MESSAGE_TYPE &&
    (row.status === "ok" || row.status === "error")
  );
}

/** Prefer full-page OAuth on phones / coarse pointers (popup often blocked). */
export function prefersFullPageOAuth(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.matchMedia("(max-width: 767px)").matches;
    const mobileUa = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    return coarse || narrow || mobileUa;
  } catch {
    return true;
  }
}

export function openCenteredOAuthPopup(url: string, name = "easternos_oauth"): Window | null {
  const width = 600;
  const height = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  return window.open(
    url,
    name,
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,status=yes`,
  );
}
