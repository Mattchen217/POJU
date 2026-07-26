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

import "@/styles/app-dialog.css";

export type AppDialogVariant = "alert" | "confirm" | "prompt";

export type AppDialogConfirmOptions = {
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirm — red primary button (delete flows). */
  tone?: "default" | "danger";
  /** Optional record/profile title shown under the message. */
  target?: string;
};

type DialogRequest = {
  variant: AppDialogVariant;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  target?: string;
  defaultValue?: string;
  resolve: (value: boolean | string | null) => void;
};

type AppDialogContextValue = {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (
    message: string,
    title?: string,
    labels?: AppDialogConfirmOptions,
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
        tone: labels?.tone,
        target: labels?.target,
      }).then((r) => r === true),
    prompt: (message, defaultValue, title) =>
      enqueue({ variant: "prompt", message, title, defaultValue }).then((r) =>
        typeof r === "string" ? r : null,
      ),
  };

  const isConfirm = request?.variant === "confirm";
  const isPrompt = request?.variant === "prompt";
  const isDanger = request?.tone === "danger";

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      {open && request ? (
        <div
          className="app-dialog-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isConfirm && !isPrompt) close(true);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={request.title ? titleId : undefined}
            aria-describedby={descId}
            className="app-dialog-panel"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {request.title ? (
              <h2 id={titleId} className="app-dialog-panel__title">
                {request.title}
              </h2>
            ) : null}
            <p
              id={descId}
              className={`app-dialog-panel__desc${request.title ? " has-title" : ""}`}
            >
              {request.message}
              {request.target ? (
                <>
                  <br />
                  <span className="app-dialog-panel__target">{request.target}</span>
                </>
              ) : null}
            </p>
            {isPrompt ? (
              <input
                ref={inputRef}
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                className="app-dialog-panel__input"
                onKeyDown={(e) => {
                  if (e.key === "Enter") close(promptValue.trim() || null);
                  if (e.key === "Escape") close(null);
                }}
                autoFocus
              />
            ) : null}
            <div className="app-dialog-panel__actions">
              {isConfirm || isPrompt ? (
                <button
                  type="button"
                  className="app-dialog-panel__cancel"
                  onClick={() => close(null)}
                >
                  {request.cancelLabel ?? "Cancel"}
                </button>
              ) : null}
              <button
                type="button"
                className={`app-dialog-panel__confirm${isDanger ? " is-danger" : ""}`}
                autoFocus={isDanger || isConfirm}
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
