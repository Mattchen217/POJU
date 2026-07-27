"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

type Props = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  onComplete?: (code: string) => void;
};

export function OtpCodeInput({ value, onChange, disabled, onComplete }: Props) {
  const t = useTranslations("auth.fields");
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  function writeDigits(next: string[]) {
    const code = next.join("").replace(/\D/g, "").slice(0, 6);
    onChange(code);
    if (code.length === 6) onComplete?.(code);
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
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          className="auth-otp__cell"
          value={digit}
          disabled={disabled}
          aria-label={`${t("otp")} ${index + 1}`}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            if (raw.length > 1) {
              // Paste into one cell
              const chars = raw.slice(0, 6).split("");
              const next = Array.from({ length: 6 }, (_, i) => chars[i] ?? "");
              writeDigits(next);
              const focusAt = Math.min(chars.length, 5);
              inputsRef.current[focusAt]?.focus();
              return;
            }
            const next = [...digits];
            next[index] = raw.slice(-1);
            writeDigits(next);
            if (raw && index < 5) inputsRef.current[index + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[index] && index > 0) {
              inputsRef.current[index - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            const next = Array.from({ length: 6 }, (_, i) => paste[i] ?? "");
            writeDigits(next);
            inputsRef.current[Math.min(paste.length, 5)]?.focus();
          }}
        />
      ))}
    </div>
  );
}
