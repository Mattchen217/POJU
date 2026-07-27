export async function postAuthJson<T extends Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: T & { error?: string; ok?: boolean } }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; ok?: boolean };
  return { ok: res.ok && data.ok !== false, status: res.status, data };
}
