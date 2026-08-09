/**
 * Sanitize post-checkout return paths so Stripe success/cancel URLs stay on-site
 * and paywalls can resume the page where Passes ran out.
 */

const STRIP_KEYS = ["checkout", "session_id", "plan", "qty", "passes"] as const;

/** Default when caller omits / sends an unsafe path — account panel. */
export function defaultCheckoutReturnPath(locale: string): string {
  return `/${locale}/app?tab=profile`;
}

/**
 * Accept pathname+search (or same-origin absolute URL). Reject open redirects.
 * Always returns a path starting with `/{locale}/`.
 */
export function sanitizeCheckoutReturnPath(raw: unknown, locale: string): string {
  const fallback = defaultCheckoutReturnPath(locale);
  if (typeof raw !== "string" || !raw.trim()) return fallback;

  let path = raw.trim();
  try {
    if (/^https?:\/\//i.test(path)) {
      const u = new URL(path);
      path = `${u.pathname}${u.search}`;
    }
  } catch {
    return fallback;
  }

  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return fallback;
  }

  if (!path.startsWith(`/${locale}/`) && path !== `/${locale}`) {
    if (path.startsWith("/app")) {
      path = `/${locale}${path}`;
    } else {
      return fallback;
    }
  }

  try {
    const u = new URL(path, "http://local.invalid");
    for (const k of STRIP_KEYS) u.searchParams.delete(k);
    path = `${u.pathname}${u.search}`;
  } catch {
    return fallback;
  }

  if (path.length > 512) return fallback;
  return path;
}

/** Current browser location as a checkout return path (client-only). */
export function currentCheckoutReturnPath(locale: string): string {
  if (typeof window === "undefined") return defaultCheckoutReturnPath(locale);
  return sanitizeCheckoutReturnPath(
    `${window.location.pathname}${window.location.search}`,
    locale,
  );
}

export function appendCheckoutResultQuery(
  returnPath: string,
  kind: "success" | "mock",
  extras?: {
    session_id?: string;
    plan?: string;
    qty?: number;
    passes?: number;
  },
): string {
  const u = new URL(returnPath, "http://local.invalid");
  u.searchParams.set("checkout", kind);
  // Stripe replaces the literal token in success_url; mock uses a real id.
  u.searchParams.set(
    "session_id",
    kind === "success" ? "{CHECKOUT_SESSION_ID}" : (extras?.session_id ?? "mock_cs"),
  );
  if (extras?.plan) u.searchParams.set("plan", extras.plan);
  if (extras?.qty != null) u.searchParams.set("qty", String(extras.qty));
  if (extras?.passes != null) u.searchParams.set("passes", String(extras.passes));
  return `${u.pathname}${u.search}`;
}
