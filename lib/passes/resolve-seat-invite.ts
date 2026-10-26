/** Client helper: create (or refresh) seat-B invite link for OAuth bind. */

export type SeatInviteResult =
  | { ok: true; absoluteUrl: string; token: string }
  | { ok: false; error: string };

export async function fetchSeatInviteAbsoluteUrl(params: {
  locale: string;
  replace?: boolean;
}): Promise<SeatInviteResult> {
  const res = await fetch("/api/household/invite-seat", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replace: params.replace === true }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    invite_path?: string;
    token?: string;
  };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error ?? "invite_failed" };
  }
  const path = data.invite_path
    ? data.invite_path.startsWith("/")
      ? `/${params.locale}${data.invite_path}`
      : `/${params.locale}/${data.invite_path}`
    : data.token
      ? `/${params.locale}/account/household/accept?token=${encodeURIComponent(data.token)}`
      : null;
  if (!path || !path.includes("token=")) {
    return { ok: false, error: "invite_failed" };
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    ok: true,
    absoluteUrl: `${origin}${path}`,
    token: data.token ?? "",
  };
}
