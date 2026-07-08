"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { toCompliantPlainText } from "@/lib/glossary/to-compliant-plain-text";

type AssistantMessageActionsProps = {
  content: string;
  locale?: string;
};

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function AssistantMessageActions({ content, locale: localeProp }: AssistantMessageActionsProps) {
  const t = useTranslations("poju.chat");
  const intlLocale = useLocale();
  const locale = localeProp ?? intlLocale;
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const compliantText = useMemo(
    () => toCompliantPlainText(content, locale),
    [content, locale],
  );

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      if (typeof window !== "undefined" && utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!compliantText) return;
    const ok = await copyTextToClipboard(compliantText);
    if (!ok) return;
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [compliantText]);

  const handleToggleRead = useCallback(() => {
    if (typeof window === "undefined" || !compliantText) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(compliantText);
    utterance.lang = /[\u4e00-\u9fff]/.test(compliantText) ? "zh-CN" : "en-US";
    utterance.onend = () => {
      utteranceRef.current = null;
      setSpeaking(false);
    };
    utterance.onerror = () => {
      utteranceRef.current = null;
      setSpeaking(false);
    };
    utteranceRef.current = utterance;
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [compliantText, speaking]);

  if (!compliantText) return null;

  return (
    <div className="pchat__msg-actions">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className={`icon-btn${copied ? " is-active" : ""}`}
        aria-label={copied ? t("message_action_copied") : t("message_action_copy")}
        title={copied ? t("message_action_copied") : t("message_action_copy")}
      >
        <span className="material-symbols-outlined">{copied ? "check" : "content_copy"}</span>
      </button>
      <button
        type="button"
        onClick={handleToggleRead}
        className={`icon-btn${speaking ? " is-active" : ""}`}
        aria-label={speaking ? t("message_action_stop_reading") : t("message_action_read_aloud")}
        title={speaking ? t("message_action_stop_reading") : t("message_action_read_aloud")}
      >
        <span className="material-symbols-outlined">{speaking ? "volume_off" : "volume_up"}</span>
      </button>
    </div>
  );
}
