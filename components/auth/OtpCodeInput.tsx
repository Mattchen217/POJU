"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

type Props = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  onComplete?: (code: string) => void;
};

/**
 * 6-box OTP. First cell uses `autocomplete="one-time-code"` + `maxLength={6}` so
 * iOS/Android can offer “Fill code from Mail” (maxLength 1 would truncate autofill).
 */
export function OtpCodeInput({ value, onChange, disabled, onComplete }: Props) {
  const t = useTranslations("auth.fields");
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const completedRef = useRef<string | null>(null);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  function applyCode(raw: string) {
    const code = raw.replace(/\D/g, "").slice(0, 6);
    onChange(code);
    if (code.length === 6 && completedRef.current !== code) {
      completedRef.current = code;
      onComplete?.(code);
    }
    if (code.length < 6) completedRef.current = null;
    return code;
  }

  return (
    <div className="auth-otp" role="group" aria-label={t("otp")}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint={index === 5 ? "done" : "next"}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          name={index === 0 ? "one-time-code" : undefined}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          /* First box must accept all 6 digits for OS autofill from Mail/SMS */
          maxLength={index === 0 ? 6 : 1}
          className="auth-otp__cell"
          value={digit}
          disabled={disabled}
          aria-label={`${t("otp")} ${index + 1}`}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            if (index === 0 && raw.length > 1) {
              const code = applyCode(raw);
              inputsRef.current[Math.min(code.length, 5)]?.focus();
              return;
            }
            if (raw.length > 1) {
              const code = applyCode(raw);
              inputsRef.current[Math.min(code.length, 5)]?.focus();
              return;
            }
            const next = [...digits];
            next[index] = raw.slice(-1);
            const code = applyCode(next.join(""));
            if (raw && index < 5) inputsRef.current[index + 1]?.focus();
            else if (code.length === 6) inputsRef.current[5]?.blur();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[index] && index > 0) {
              inputsRef.current[index - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            const code = applyCode(paste);
            inputsRef.current[Math.min(Math.max(code.length, 1) - 1, 5)]?.focus();
          }}
        />
      ))}
    </div>
  );
}
