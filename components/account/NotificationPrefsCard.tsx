"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

type Prefs = {
  notify_pass_low: boolean;
  notify_marketing: boolean;
};

type Props = {
  initial: Prefs;
  onSaved?: (prefs: Prefs) => void;
};

export function NotificationPrefsCard({ initial, onSaved }: Props) {
  const t = useTranslations("account");
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  async function patch(next: Prefs) {
    setBusy(true);
    setError(false);
    setSaved(false);
    const prev = prefs;
    setPrefs(next);
    try {
      const res = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(next),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        notify_pass_low?: boolean;
        notify_marketing?: boolean;
      };
      if (!res.ok || !data.ok) {
        setPrefs(prev);
        setError(true);
        return;
      }
      const savedPrefs = {
        notify_pass_low: data.notify_pass_low ?? next.notify_pass_low,
        notify_marketing: data.notify_marketing ?? next.notify_marketing,
      };
      setPrefs(savedPrefs);
      setSaved(true);
      onSaved?.(savedPrefs);
    } catch {
      setPrefs(prev);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-glass-card flex flex-col gap-3">
      <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--ws-text-muted,#71717a)]">
        {t("preferences")}
      </p>
      <p className="m-0 text-sm text-[var(--ws-text-secondary,#a1a1aa)]">{t("preferencesHint")}</p>

      <label className="flex items-start gap-3 text-sm text-[var(--ws-text-body,#e0e2e8)]">
        <input
          type="checkbox"
          className="mt-1"
          checked={prefs.notify_pass_low}
          disabled={busy}
          onChange={(e) =>
            void patch({ ...prefs, notify_pass_low: e.target.checked })
          }
        />
        <span>{t("notifyPassLow")}</span>
      </label>

      <label className="flex items-start gap-3 text-sm text-[var(--ws-text-body,#e0e2e8)]">
        <input
          type="checkbox"
          className="mt-1"
          checked={prefs.notify_marketing}
          disabled={busy}
          onChange={(e) =>
            void patch({ ...prefs, notify_marketing: e.target.checked })
          }
        />
        <span>{t("notifyMarketing")}</span>
      </label>

      {saved ? (
        <p className="m-0 text-xs text-[var(--ws-text-secondary,#9a9cae)]">{t("prefsSaved")}</p>
      ) : null}
      {error ? (
        <p className="m-0 text-xs text-[#fca5a5]" role="alert">
          {t("prefsError")}
        </p>
      ) : null}
    </div>
  );
}
