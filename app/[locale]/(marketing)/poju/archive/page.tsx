"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { POJUSessionRecord } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { listPOJUV4SessionRowsForDevice } from "@/lib/poju/session-manager";
import { permanentlyDeletePOJUV4Session, runPOJUV4SessionMaintenance, setPOJUV4SessionStatus } from "@/lib/poju/v4-lifecycle";
import { redirectToPojuSessionPayment } from "@/lib/poju/start-poju-session-payment";

export default function PojuArchivePage() {
  const t = useTranslations("poju.archive");
  const locale = useLocale();
  const [rows, setRows] = useState<POJUSessionRecord[]>([]);

  const reload = useCallback(async () => {
    await runPOJUV4SessionMaintenance();
    const deviceId = getPojuDeviceId();
    const list = await listPOJUV4SessionRowsForDevice(deviceId);
    setRows(list.sort((a, b) => b.last_interaction_at.getTime() - a.last_interaction_at.getTime()));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const active = rows.filter((r) => r.status === "active");
  const paused = rows.filter((r) => r.status === "paused");
  const resolved = rows.filter((r) => r.status === "resolved");
  const archived = rows.filter((r) => r.status === "archived");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-white">
      <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
      <p className="mt-2 text-sm text-white/65">{t("subtitle")}</p>
      <p className="mt-4">
        <Link href="/poju" className="text-sm text-violet-300 underline">
          {t("back")}
        </Link>
      </p>

      <SessionSection title={`${t("section_active")} (${active.length})`} rows={active} onChange={reload} locale={locale} t={t} />
      <SessionSection title={`${t("section_paused")} (${paused.length})`} rows={paused} onChange={reload} locale={locale} t={t} />
      <SessionSection title={`${t("section_resolved")} (${resolved.length})`} rows={resolved} onChange={reload} locale={locale} t={t} />
      <SessionSection title={`${t("section_archived")} (${archived.length})`} rows={archived} onChange={reload} locale={locale} t={t} />
    </main>
  );
}

function SessionSection({
  title,
  rows,
  onChange,
  locale,
  t,
}: {
  title: string;
  rows: POJUSessionRecord[];
  onChange: () => void;
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium text-amber-100/90">{title}</h2>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li
            key={row.session_id}
            className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-white/80"
          >
            <div className="font-medium text-white/90">&ldquo;{row.original_question}&rdquo;</div>
            <div className="mt-1 text-xs text-white/50">
              {t("meta_expires")}: {row.expires_at.toLocaleDateString()} · {t("meta_status")}: {row.status}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {row.status === "active" || row.status === "paused" ? (
                <Link
                  href={`/poju/session/${row.session_id}`}
                  className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-medium text-white"
                >
                  {t("continue")}
                </Link>
              ) : null}
              {row.status === "active" ? (
                <button
                  type="button"
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/85"
                  onClick={() => void pauseRow(row.session_id, onChange)}
                >
                  {t("pause")}
                </button>
              ) : null}
              {row.status === "archived" ? (
                <>
                  <button
                    type="button"
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/85"
                    onClick={() => void restoreRow(row.session_id, locale)}
                  >
                    {t("restore_paid")}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs text-red-200"
                    onClick={() => void deleteRow(row.session_id, onChange, t)}
                  >
                    {t("delete_forever")}
                  </button>
                </>
              ) : null}
              {row.status === "resolved" ? (
                <button
                  type="button"
                  className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs text-red-200"
                  onClick={() => void deleteRow(row.session_id, onChange, t)}
                >
                  {t("delete_forever")}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function pauseRow(sessionId: string, onChange: () => void) {
  await setPOJUV4SessionStatus(sessionId, "paused");
  onChange();
}

async function restoreRow(sessionId: string, locale: string) {
  await redirectToPojuSessionPayment({ action: "restore", sessionId, locale });
}

async function deleteRow(sessionId: string, onChange: () => void, t: (key: string) => string) {
  if (!window.confirm(t("delete_confirm"))) return;
  await permanentlyDeletePOJUV4Session(sessionId);
  onChange();
}
