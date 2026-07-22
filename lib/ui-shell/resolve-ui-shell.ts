/**
 * Parallel UI shell switch: classic (current marketing) vs workspace (left-sidebar app).
 * Precedence: ?ui= → localStorage → NEXT_PUBLIC_UI_SHELL → classic.
 */

export type UiShellMode = "classic" | "workspace";

export const UI_SHELL_STORAGE_KEY = "poju.uiShell";
export const WORKSPACE_ENTERED_KEY = "poju.workspaceEntered";

export type WorkspaceTab =
  | "atmos"
  | "poju"
  | "match"
  | "syncro"
  | "glyph"
  | "archive"
  | "profile";

export const WORKSPACE_ENGINE_TABS = ["atmos", "poju", "match", "syncro", "glyph"] as const;

export const WORKSPACE_TAB_LABELS: Record<WorkspaceTab, string> = {
  atmos: "Atmos",
  poju: "POJU",
  match: "Match",
  syncro: "Syncro",
  glyph: "Glyph",
  archive: "Archive",
  profile: "Profile",
};

const PRODUCT_TO_TAB: Record<string, WorkspaceTab> = {
  poju: "poju",
  glyph: "glyph",
  syncro: "syncro",
  match: "match",
  archive: "archive",
};

export function parseUiShellValue(raw: string | null | undefined): UiShellMode | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "classic" || v === "marketing" || v === "0" || v === "false") return "classic";
  if (v === "workspace" || v === "app" || v === "1" || v === "true") return "workspace";
  return null;
}

export function getEnvUiShell(): UiShellMode {
  return parseUiShellValue(process.env.NEXT_PUBLIC_UI_SHELL) ?? "classic";
}

export function readStoredUiShell(): UiShellMode | null {
  if (typeof window === "undefined") return null;
  try {
    return parseUiShellValue(window.localStorage.getItem(UI_SHELL_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredUiShell(mode: UiShellMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_SHELL_STORAGE_KEY, mode);
  } catch {
    /* private mode */
  }
}

export function readQueryUiShell(search?: string | URLSearchParams | null): UiShellMode | null {
  if (typeof window === "undefined" && !search) return null;
  try {
    const params =
      search instanceof URLSearchParams
        ? search
        : new URLSearchParams(
            typeof search === "string"
              ? search.startsWith("?")
                ? search.slice(1)
                : search
              : window.location.search,
          );
    return parseUiShellValue(params.get("ui"));
  } catch {
    return null;
  }
}

/** Client/runtime resolve. Safe on server with env-only when no window. */
export function resolveUiShell(opts?: {
  query?: string | URLSearchParams | null;
  stored?: UiShellMode | null;
}): UiShellMode {
  const fromQuery = readQueryUiShell(opts?.query ?? null);
  if (fromQuery) return fromQuery;

  if (opts?.stored !== undefined) {
    if (opts.stored) return opts.stored;
  } else {
    const stored = readStoredUiShell();
    if (stored) return stored;
  }

  return getEnvUiShell();
}

export function isWorkspaceShell(mode?: UiShellMode): boolean {
  return (mode ?? resolveUiShell()) === "workspace";
}

export function parseWorkspaceTab(raw: string | null | undefined): WorkspaceTab {
  const v = (raw ?? "").trim().toLowerCase();
  if (
    v === "atmos" ||
    v === "poju" ||
    v === "match" ||
    v === "syncro" ||
    v === "glyph" ||
    v === "archive" ||
    v === "profile"
  ) {
    return v;
  }
  return "atmos";
}

export function getWorkspaceHref(tab: WorkspaceTab = "atmos"): string {
  return `/app?tab=${tab}`;
}

/** Remap classic product marketing hrefs to workspace deep-links when shell is workspace. */
export function mapProductHrefForShell(href: string, shell: UiShellMode): string {
  if (shell !== "workspace") return href;
  const path = href.split("?")[0] ?? href;
  const segment = path.replace(/^\//, "").split("/")[0] ?? "";
  const tab = PRODUCT_TO_TAB[segment];
  if (!tab) return href;
  return getWorkspaceHref(tab);
}

export function markWorkspaceEntered(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKSPACE_ENTERED_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function hasWorkspaceEntered(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(WORKSPACE_ENTERED_KEY) === "1";
  } catch {
    return false;
  }
}
