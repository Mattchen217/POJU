/**
 * OAuth popup used while binding seat B — must not switch the opener session.
 */

export const OAUTH_BIND_MESSAGE_TYPE = "easternos-oauth-bind-done" as const;

export type OAuthBindMessage = {
  type: typeof OAUTH_BIND_MESSAGE_TYPE;
  status: "ok" | "error";
  error?: string | null;
};

export function isOAuthBindMessage(data: unknown): data is OAuthBindMessage {
  if (!data || typeof data !== "object") return false;
  const row = data as Record<string, unknown>;
  return (
    row.type === OAUTH_BIND_MESSAGE_TYPE &&
    (row.status === "ok" || row.status === "error")
  );
}
