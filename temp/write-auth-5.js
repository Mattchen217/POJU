const fs = require("fs");
const path = require("path");

// Patch EmailPasswordForm onSendCode result type for skipOtp
const formPath = "D:/POJU/pojulife/components/auth/EmailPasswordForm.tsx";
let form = fs.readFileSync(formPath, "utf8");
form = form.replace(
  "onSendCode?: (values: {\n    email: string;\n    password: string;\n    confirm?: string;\n  }) => Promise<{ ok: boolean; error?: string }>;",
  "onSendCode?: (values: {\n    email: string;\n    password: string;\n    confirm?: string;\n  }) => Promise<{ ok: boolean; error?: string; skipOtp?: boolean }>;"
);
form = form.replace(
  `      if (!result.ok) {
        setSendError(result.error ?? "send_failed");
        return;
      }
      setCodeSent(true);
      setOtp("");
      setResendLeft(60);`,
  `      if (!result.ok) {
        setSendError(result.error ?? "send_failed");
        return;
      }
      if (result.skipOtp) {
        // Session already established (confirm-email off) — parent navigates away.
        return;
      }
      setCodeSent(true);
      setOtp("");
      setResendLeft(60);`
);
fs.writeFileSync(formPath, form, "utf8");
console.log("patched form");

const signupPath = "D:/POJU/pojulife/app/[locale]/(auth)/signup/page.tsx";
let signup = fs.readFileSync(signupPath, "utf8");
signup = signup.replace(
  `          // Confirm-email off: session already established — finish without OTP.
          if (data.needs_verification === false) {
            goNext(router, next);
            return { ok: false, error: undefined };
          }
          return { ok: true };`,
  `          // Confirm-email off: session already established — finish without OTP.
          if (data.needs_verification === false) {
            goNext(router, next);
            return { ok: true, skipOtp: true };
          }
          return { ok: true };`
);
fs.writeFileSync(signupPath, signup, "utf8");
console.log("patched signup");

// Append CSS for password toggle + verify block
const cssPath = "D:/POJU/pojulife/components/auth/auth.css";
let css = fs.readFileSync(cssPath, "utf8");
if (!css.includes("auth-field__control")) {
  css += `

.auth-field__control {
  position: relative;
  display: flex;
  align-items: center;
}

.auth-field__control input {
  padding-right: 4.75rem;
}

.auth-field__toggle {
  position: absolute;
  right: 0.45rem;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #a1a1aa;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  padding: 0.35rem 0.45rem;
  border-radius: 0.35rem;
}

.auth-field__toggle:hover {
  color: #f2ca50;
}

.auth-field__toggle:focus-visible {
  outline: 2px solid rgba(212, 175, 55, 0.7);
  outline-offset: 1px;
}

.auth-verify-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.auth-verify-block__hint {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.45;
  color: #a1a1aa;
  text-transform: none;
  letter-spacing: normal;
  font-weight: 500;
}

.auth-inline-error {
  font-style: normal;
  font-size: 0.8rem;
  font-weight: 500;
  color: #fca5a5;
}

.auth-error__text {
  margin: 0;
}

.auth-error__cta {
  margin: 0.45rem 0 0;
  font-size: 0.88rem;
}

.auth-error__cta a {
  color: #f2ca50;
  font-weight: 600;
  text-decoration: none;
}

.auth-error__cta a:hover {
  text-decoration: underline;
}
`;
  fs.writeFileSync(cssPath, css, "utf8");
  console.log("patched css");
}
