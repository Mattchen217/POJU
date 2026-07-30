"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";

import { UnderstandingGateActions } from "@/components/poju/UnderstandingGateActions";
import { PojuReplyOptions } from "@/components/poju/PojuReplyOptions";
import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";
import { useWorkspaceMatchPrepare } from "@/components/workspace/WorkspaceMatchPrepareContext";
import { distillMatchClarification } from "@/lib/clarification/distill";
import type {
  ClarificationMessage,
  MatchClarificationFields,
} from "@/lib/clarification/types";
import {
  matchPersonFactsFromBirth,
  type MatchPersonFacts,
} from "@/lib/match/clarification/match-person-facts";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";

import "@/components/poju/poju-chat.css";

type ChatMessage = ClarificationMessage & {
  id: string;
  /** Gate playback — omitted from API history when user supplements. */
  kind?: "gate_summary";
};

type ClarifyApiOk = {
  ok: true;
  response: string;
  options?: string[];
  understanding_sufficient: boolean;
  fields: MatchClarificationFields;
  summary_for_confirm?: string;
};

type Props = {
  /** Match hero copy above the message stream (scrolls with context). */
  header?: ReactNode;
  /** Called when user confirms understanding — receives distilled relationship_description. */
  onClarified: (relationshipDescription: string) => void;
  submitBusy?: boolean;
  /** Example prompts shown before the first user message (seed as first turn). */
  examplePrompts?: { key: string; text: string }[];
  examplesLabel?: string;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function AssistantBubble({ children }: { children: ReactNode }) {
  /* Pivot glass AI bubble — no avatar (Match inquiry). */
  return (
    <div className="pchat__ai-col pchat__ai-col--solo">
      <div className="pchat__ai">{children}</div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      className="pchat__send-btn__icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M16.1401 2.96004L7.11012 5.96004C1.04012 7.99004 1.04012 11.3 7.11012 13.32L9.79012 14.21L10.6801 16.89C12.7001 22.96 16.0201 22.96 18.0401 16.89L21.0501 7.87004C22.3901 3.82004 20.1901 1.61004 16.1401 2.96004ZM16.4601 8.34004L12.6601 12.16C12.5101 12.31 12.3201 12.38 12.1301 12.38C11.9401 12.38 11.7501 12.31 11.6001 12.16C11.3101 11.87 11.3101 11.39 11.6001 11.1L15.4001 7.28004C15.6901 6.99004 16.1701 6.99004 16.4601 7.28004C16.7501 7.57004 16.7501 8.05004 16.4601 8.34004Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Match inquiry chat — Pivot page scroll + docked composer (no nested message frame).
 */
export function WorkspaceMatchInquiryChat({
  header,
  onClarified,
  submitBusy = false,
  examplePrompts = [],
  examplesLabel,
}: Props) {
  const locale = useLocale();
  const tChat = useTranslations("poju.chat");
  const { profileIdA, profileIdB } = useWorkspaceMatchPrepare();
  const fieldId = useId();
  const pageViewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [fields, setFields] = useState<MatchClarificationFields>({
    relationship_type: "",
    concern_focus: "",
    concrete_matter: "",
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"connection" | "short" | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [activeExample, setActiveExample] = useState<string | null>(null);
  const [personA, setPersonA] = useState<MatchPersonFacts | null>(null);
  const [personB, setPersonB] = useState<MatchPersonFacts | null>(null);
  /** User clicked gate supplement — next send continues clarify with after_gate_supplement. */
  const [awaitingSupplement, setAwaitingSupplement] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!profileIdA || !profileIdB) return;
      try {
        const [aRow, bRow] = await Promise.all([
          getStoredProfile(profileIdA),
          getStoredProfile(profileIdB),
        ]);
        if (cancelled) return;
        setPersonA(matchPersonFactsFromBirth("Match A", aRow?.birth_info));
        setPersonB(matchPersonFactsFromBirth("Match B", bRow?.birth_info));
      } catch (e) {
        console.error("[match-inquiry-chat] load person facts failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileIdA, profileIdB]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const liveOptions =
    !gateOpen &&
    !busy &&
    !submitBusy &&
    lastAssistant?.options &&
    lastAssistant.options.length >= 2
      ? lastAssistant.options
      : undefined;
  const placeholder = liveOptions
    ? tChat("input_placeholder_with_options")
    : tChat("input_placeholder");

  const showExamples = messages.length === 0 && examplePrompts.length > 0 && !busy;
  const composerLocked = busy || submitBusy;

  useEffect(() => {
    const el = pageViewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, gateOpen, busy, showExamples]);

  const runTurn = useCallback(
    async (
      nextMessages: ChatMessage[],
      prior: MatchClarificationFields,
      opts?: { after_gate_supplement?: boolean },
    ) => {
      setBusy(true);
      setError(null);
      try {
        const afterSupplement = Boolean(opts?.after_gate_supplement);
        // Drop gate playback from the model context so it must read the new user text
        // instead of echoing the previous confirmation summary.
        const apiMessages = (
          afterSupplement
            ? nextMessages.filter((m) => m.kind !== "gate_summary")
            : nextMessages
        ).map(({ role, content }) => ({ role, content }));

        const res = await fetch("/api/match/clarify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            locale,
            messages: apiMessages,
            prior_fields: prior,
            person_a: personA,
            person_b: personB,
            after_gate_supplement: afterSupplement,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as ClarifyApiOk & {
          error?: string;
          message?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.message || data.error || "clarify_failed");
        }

        setFields(data.fields);
        setAwaitingSupplement(false);
        const summary = data.summary_for_confirm?.trim() || "";
        const useSummary = Boolean(data.understanding_sufficient && summary);
        const assistant: ChatMessage = {
          id: newId(),
          role: "assistant",
          content: useSummary ? summary : data.response,
          options: data.understanding_sufficient ? undefined : data.options,
          kind: useSummary ? "gate_summary" : undefined,
        };
        setMessages((prev) => [...prev, assistant]);

        if (data.understanding_sufficient) {
          setGateOpen(true);
        } else {
          setGateOpen(false);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError("connection");
        console.error("[match-inquiry-chat] turn failed:", e, msg);
      } finally {
        setBusy(false);
      }
    },
    [locale, personA, personB],
  );

  const sendUserText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || submitBusy) return;

      const fromSupplement = gateOpen || awaitingSupplement;
      if (gateOpen) {
        setGateOpen(false);
      }

      const userMsg: ChatMessage = { id: newId(), role: "user", content: trimmed };
      const cleared = messages.map((m) =>
        m.role === "assistant" && m.options?.length
          ? { ...m, options: undefined }
          : m,
      );
      const next = [...cleared, userMsg];
      setMessages(next);
      setInput("");
      setActiveExample(null);
      await runTurn(next, fields, { after_gate_supplement: fromSupplement });
    },
    [busy, submitBusy, gateOpen, awaitingSupplement, messages, fields, runTurn],
  );

  function handleConfirm() {
    if (submitBusy) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const distilled = distillMatchClarification(fields, locale, lastUser);
    if (distilled.trim().length < 10) {
      setError("short");
      return;
    }
    onClarified(distilled);
  }

  function handleSupplement() {
    if (busy || submitBusy) return;
    // Same as Pivot: close gate only — user types in composer, then send calls clarify.
    setGateOpen(false);
    setAwaitingSupplement(true);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div className="pchat pchat--workspace workspace-match-inquiry-chat">
      <div className="pchat__main pchat__main--workspace">
        <WorkspaceScrollArea
          className="workspace-match-inquiry-chat__page-scroll"
          fixedThumbPx={52}
          viewportRef={pageViewportRef}
          viewportClassName="workspace-match-inquiry-chat__page-viewport"
        >
          <div className="workspace-match-inquiry-stage">
            {header}

            <div className="pchat__messages" aria-live="polite">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="pchat__msg pchat__msg--user">
                    <div className="pchat__user-row">
                      <div className="pchat__bubble">{m.content}</div>
                      <span className="pchat__user-accent" aria-hidden />
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="pchat__msg pchat__msg--ai">
                    <AssistantBubble>
                      {m.content.split("\n").map((line, i) => (
                        <p key={i}>{line || "\u00a0"}</p>
                      ))}
                    </AssistantBubble>
                  </div>
                ),
              )}

              {busy ? (
                <p className="workspace-match-inquiry-chat__status" aria-busy>
                  {tChat("sending")}
                </p>
              ) : null}
              {error ? (
                <p className="workspace-match-inquiry-chat__error" role="alert">
                  {error === "short"
                    ? locale.startsWith("zh")
                      ? "请再补充一点具体内容。"
                      : "Please add a bit more detail."
                    : tChat("dialog_connection_error")}
                </p>
              ) : null}
            </div>

            {showExamples ? (
              <>
                {examplesLabel ? (
                  <p className="workspace-match-inquiry__examples-label">{examplesLabel}</p>
                ) : null}
                <div
                  className="workspace-match-inquiry__examples"
                  role="group"
                  aria-label={examplesLabel || "Examples"}
                >
                  {examplePrompts.map((ex) => (
                    <button
                      key={ex.key}
                      type="button"
                      className={`workspace-match-inquiry__example${
                        activeExample === ex.key ? " is-active" : ""
                      }`}
                      aria-pressed={activeExample === ex.key}
                      disabled={composerLocked}
                      onClick={() => {
                        setActiveExample(ex.key);
                        setInput(ex.text.slice(0, 2000));
                        window.setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                    >
                      {ex.text}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </WorkspaceScrollArea>

        <div className="pchat__inputbar workspace-match-inquiry-chat__dock">
          <div
            className={
              gateOpen || liveOptions
                ? "pchat__composer-unit pchat__composer-unit--with-options"
                : "pchat__composer-unit"
            }
          >
            {gateOpen ? (
              <div className="pchat__composer-options workspace-match-inquiry-chat__gate-dock">
                <UnderstandingGateActions
                  busy={busy || submitBusy}
                  onConfirm={handleConfirm}
                  onSupplement={handleSupplement}
                />
              </div>
            ) : liveOptions ? (
              <div className="pchat__composer-options">
                <PojuReplyOptions
                  options={liveOptions}
                  busy={composerLocked}
                  onPick={(opt) => void sendUserText(opt)}
                  onEdit={(opt) => {
                    setInput(opt);
                    inputRef.current?.focus();
                  }}
                  groupLabel={tChat("reply_options_group_label")}
                  editLabel={tChat("reply_option_edit_label")}
                />
              </div>
            ) : null}

            <div className="pchat__composer-field">
              <label className="sr-only" htmlFor={fieldId}>
                {placeholder}
              </label>
              <textarea
                id={fieldId}
                ref={inputRef}
                className="pchat__textarea"
                rows={1}
                value={input}
                placeholder={placeholder}
                disabled={composerLocked}
                onChange={(e) => setInput(e.target.value.slice(0, 2000))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendUserText(input);
                  }
                }}
              />
            </div>

            <div className="pchat__composer-toolbar">
              <div className="pchat__composer-toolbar__tools" aria-hidden />
              <button
                type="button"
                className="pchat__send-btn"
                disabled={composerLocked || !input.trim()}
                onClick={() => void sendUserText(input)}
                aria-label={tChat("send")}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
