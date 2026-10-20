const fs = require("fs");

// Reset password page with show/hide
const resetPath = "D:/POJU/pojulife/app/[locale]/(auth)/reset-password/page.tsx";
let reset = fs.readFileSync(resetPath, "utf8");
if (!reset.includes("showPassword")) {
  reset = reset.replace(
    'import { Suspense, useRef, useState } from "react";',
    'import { Suspense, useRef, useState } from "react";'
  );
  reset = reset.replace(
    "  const [submitting, setSubmitting] = useState(false);\n  const inFlight = useRef(false);",
    "  const [submitting, setSubmitting] = useState(false);\n  const [showPassword, setShowPassword] = useState(false);\n  const [showConfirm, setShowConfirm] = useState(false);\n  const inFlight = useRef(false);"
  );
  reset = reset.replace(
    `          <label className="auth-field">
            <span>{tFields("password")}</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder={tFields("passwordPlaceholder")}
              disabled={submitting}
              {...register("password")}
            />
            {errors.password ? <em>{tErr("weak_password")}</em> : null}
          </label>
          <PasswordStrengthHint password={password} />
          <label className="auth-field">
            <span>{tFields("confirmPassword")}</span>
            <input
              type="password"
              autoComplete="new-password"
              disabled={submitting}
              {...register("confirm")}
            />
            {errors.confirm ? <em>{tErr("password_mismatch")}</em> : null}
          </label>`,
    `          <label className="auth-field">
            <span>{tFields("password")}</span>
            <div className="auth-field__control">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={tFields("passwordPlaceholder")}
                disabled={submitting}
                {...register("password")}
              />
              <button
                type="button"
                className="auth-field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? tFields("hidePassword") : tFields("showPassword")}
              >
                {showPassword ? tFields("hidePassword") : tFields("showPassword")}
              </button>
            </div>
            {errors.password ? <em>{tErr("weak_password")}</em> : null}
          </label>
          <PasswordStrengthHint password={password} />
          <label className="auth-field">
            <span>{tFields("confirmPassword")}</span>
            <div className="auth-field__control">
              <input
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                disabled={submitting}
                {...register("confirm")}
              />
              <button
                type="button"
                className="auth-field__toggle"
                onClick={() => setShowConfirm((v) => !v)}
                aria-pressed={showConfirm}
                aria-label={showConfirm ? tFields("hidePassword") : tFields("showPassword")}
              >
                {showConfirm ? tFields("hidePassword") : tFields("showPassword")}
              </button>
            </div>
            {errors.confirm ? <em>{tErr("password_mismatch")}</em> : null}
          </label>`
  );
  fs.writeFileSync(resetPath, reset, "utf8");
  console.log("reset updated");
} else {
  console.log("reset already has toggle");
}

// next.config register redirect
const ncPath = "D:/POJU/pojulife/next.config.mjs";
let nc = fs.readFileSync(ncPath, "utf8");
if (!nc.includes('source: "/register"')) {
  nc = nc.replace(
    `      {
        source: "/oracle",
        destination: "/glyph",
        permanent: true,
      },`,
    `      {
        source: "/register",
        destination: "/signup",
        permanent: false,
      },
      {
        source: "/:locale(zh|es|fr)/register",
        destination: "/:locale/signup",
        permanent: false,
      },
      {
        source: "/oracle",
        destination: "/glyph",
        permanent: true,
      },`
  );
  fs.writeFileSync(ncPath, nc, "utf8");
  console.log("next.config updated");
} else {
  console.log("register redirect exists");
}

// Search POJU universe map elsewhere
const { execSync } = require("child_process");
try {
  const out = execSync('findstr /s /i /m "POJU universe" messages\\*.json app\\*.tsx components\\*.tsx 2>nul', { cwd: "D:/POJU/pojulife", encoding: "utf8" });
  console.log("POJU universe hits:", out || "(none)");
} catch (e) {
  console.log("POJU universe search done", e.status);
}
