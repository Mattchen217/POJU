"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type AppDialogVariant = "alert" | "confirm" | "prompt";

type DialogRequest = {
  variant: AppDialogVariant;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
  resolve: (value: boolean | string | null) => void;
};

type AppDialogContextValue = {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (
    message: string,
    title?: string,
    labels?: { confirmLabel?: string; cancelLabel?: string },
  ) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string, title?: string) => Promise<string | null>;
};

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();

  const enqueue = useCallback((req: Omit<DialogRequest, "resolve">) => {
    return new Promise<boolean | string | null>((resolve) => {
      setRequest({ ...req, resolve });
      setPromptValue(req.defaultValue ?? "");
      setOpen(true);
    });
  }, []);

  const close = useCallback(
    (result: boolean | string | null) => {
      request?.resolve(result);
      setOpen(false);
      setRequest(null);
    },
    [request],
  );

  const value: AppDialogContextValue = {
    alert: (message, title) =>
      enqueue({ variant: "alert", message, title, confirmLabel: "OK" }).then(() => undefined),
    confirm: (message, title, labels) =>
      enqueue({
        variant: "confirm",
        message,
        title,
        confirmLabel: labels?.confirmLabel,
        cancelLabel: labels?.cancelLabel,
      }).then((r) => r === true),
    prompt: (message, defaultValue, title) =>
      enqueue({ variant: "prompt", message, title, defaultValue }).then((r) =>
        typeof r === "string" ? r : null,
      ),
  };

  const isConfirm = request?.variant === "confirm";
  const isPrompt = request?.variant === "prompt";

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      {open && request ? (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isConfirm && !isPrompt) close(true);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-br from-[#221f33] to-[#1a1824] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {request.title ? (
              <h2 id={titleId} className="text-lg font-semibold text-on-surface">
                {request.title}
              </h2>
            ) : null}
            <p id={descId} className={`whitespace-pre-line text-sm leading-relaxed text-on-surface-variant ${request.title ? "mt-3" : ""}`}>
              {request.message}
            </p>
            {isPrompt ? (
              <input
                ref={inputRef}
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                className="mt-4 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-on-surface outline-none focus:border-violet-400/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter") close(promptValue.trim() || null);
                  if (e.key === "Escape") close(null);
                }}
                autoFocus
              />
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {isConfirm || isPrompt ? (
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-on-surface-variant hover:bg-white/5"
                  onClick={() => close(null)}
                >
                  {request.cancelLabel ?? "Cancel"}
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                onClick={() => {
                  if (isPrompt) close(promptValue.trim() || null);
                  else close(true);
                }}
              >
                {request.confirmLabel ?? (isConfirm || isPrompt ? "OK" : "OK")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog(): AppDialogContextValue {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error("useAppDialog must be used within AppDialogProvider");
  }
  return ctx;
}
