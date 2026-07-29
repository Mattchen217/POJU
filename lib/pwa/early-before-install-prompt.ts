/**
 * Capture `beforeinstallprompt` before React hydrates.
 * Chrome often fires this once, very early; if nothing calls preventDefault + stores it,
 * JS can never call prompt() later — only the omnibox install icon remains.
 */
export const POJU_DEFERRED_INSTALL_KEY = "__POJU_DEFERRED_INSTALL_PROMPT";

export const EARLY_BEFORE_INSTALL_PROMPT_SCRIPT = `(function(){try{var k=${JSON.stringify(POJU_DEFERRED_INSTALL_KEY)};window[k]=window[k]||null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window[k]=e;window._deferredInstallPrompt=e;});}catch(e){}})();`;

export function readEarlyDeferredInstallPrompt(): Event | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    [POJU_DEFERRED_INSTALL_KEY]?: Event | null;
    _deferredInstallPrompt?: Event;
  };
  return w[POJU_DEFERRED_INSTALL_KEY] ?? w._deferredInstallPrompt ?? null;
}

export function clearEarlyDeferredInstallPrompt(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & {
    [POJU_DEFERRED_INSTALL_KEY]?: Event | null;
    _deferredInstallPrompt?: Event;
  };
  w[POJU_DEFERRED_INSTALL_KEY] = null;
  delete w._deferredInstallPrompt;
}
