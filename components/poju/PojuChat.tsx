"use client";

/* ============================================================
   PojuChat.tsx  —  POJU 聊天页组件(Claude 规格,PC + PWA)
   ------------------------------------------------------------
   UI / 布局 / 尺寸全部由本组件 + poju-chat.css 控制,
   数据通过 props 接入(Cursor 把现有 store / api 接到这些 props)。
   图标用 emoji 占位,可替换成 lucide-react 等现有图标库。
   ============================================================ */

import { useState, useRef, useEffect, type JSX, type ReactNode } from "react";
import Image from "next/image";
import pojuAvatar from "@/assets/icons/P.png";
import { ThinkingStream } from "@/components/poju/ThinkingStream";
import { LiveThinkingTicker } from "@/components/poju/LiveThinkingTicker";
import { StreamingAssistantBubble } from "@/components/poju/StreamingAssistantBubble";
import type { ThinkingStreamMode } from "@/lib/poju/thinking-stream-mode";
import "./poju-chat.css";

/* ---------- 数据类型(若项目已有同义类型,用现有的)---------- */
export interface PojuMessage {
  id: string;
  role: "user" | "assistant";
  content: string; // assistant 内容可能含 "### 标题" 和 "═══ 分隔 ═══"
}
export interface PojuSession {
  id: string;
  title: string;
  updatedAt?: string;
}

/* ---------- Props:数据接入点 ----------
   Cursor 需要做的全部事情:把现有的会话/消息数据与发送/流式
   逻辑接到下面这些 props 上。UI 不用动。 */
export interface PojuChatProps {
  sessions: PojuSession[];
  currentSessionId: string | null;
  messages: PojuMessage[];
  isStreaming?: boolean;
  streamingText?: string; // 正在流式输出的正文(逐块更新)
  thinkingMode?: ThinkingStreamMode | null;
  thinkingLocale?: string;
  liveThinkingLine?: string | null;
  thinkingWaitLabel?: string;
  onSend: (text: string) => void;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onCopy?: (text: string) => void;
  onSpeak?: (text: string) => void;
  inputPlaceholder?: string;
  onAttach?: () => void;
  onVoice?: () => void;
  onStop?: () => void;
  newSessionDisabled?: boolean;
  composerText?: string;
  onComposerTextChange?: (value: string) => void;
}

/* ---------- AI 文本渲染(不用 Tailwind prose,避免 65ch 限制)----------
   支持:### 标题 / ═══ XXX ═══ 分隔行 / 普通段落 */
function renderAiContent(text: string): JSX.Element[] {
  const lines = text.split("\n");
  const out: JSX.Element[] = [];
  let buf: string[] = [];
  const flush = (key: string) => {
    if (buf.length) {
      out.push(<p key={key}>{buf.join("\n")}</p>);
      buf = [];
    }
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("### ")) {
      flush(`p${i}`);
      out.push(<h3 key={`h${i}`}>{t.slice(4)}</h3>);
    } else if (/^[═=]{2,}.*[═=]{2,}$/.test(t)) {
      flush(`p${i}`);
      out.push(
        <div className="pchat__divider" key={`d${i}`}>
          {t.replace(/[═=]/g, "").trim()}
        </div>
      );
    } else if (t === "") {
      flush(`p${i}`);
    } else {
      buf.push(line);
    }
  });
  flush("pEnd");
  return out;
}

function PojuAiAvatar() {
  return (
    <Image
      src={pojuAvatar}
      alt=""
      width={40}
      height={40}
      className="pchat__ai-avatar"
    />
  );
}

function AiReplyShell({ children }: { children: ReactNode }) {
  return (
    <div className="pchat__ai-row">
      <PojuAiAvatar />
      <div className="pchat__ai">{children}</div>
    </div>
  );
}

export default function PojuChat(props: PojuChatProps) {
  const {
    sessions, currentSessionId, messages,
    isStreaming, streamingText,
    thinkingMode, thinkingLocale, liveThinkingLine, thinkingWaitLabel,
    onSend,
    onNewSession,
    onSelectSession,
    onDeleteSession,
    onCopy,
    onSpeak,
    inputPlaceholder,
    onAttach,
    onVoice,
    onStop,
    newSessionDisabled,
    composerText,
    onComposerTextChange,
  } = props;

  const [input, setInput] = useState("");
  const textareaValue = composerText ?? input;
  const setTextareaValue = onComposerTextChange ?? setInput;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* 输入框自适应高度 */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [textareaValue]);

  /* 新消息 / 流式时自动滚到底 */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [messages, streamingText, thinkingMode, liveThinkingLine]);

  const send = () => {
    const t = textareaValue.trim();
    if (!t || isStreaming) return;
    onSend(t);
    setTextareaValue("");
  };

  const activeTitle =
    sessions.find((s) => s.id === currentSessionId)?.title || "POJU";

  return (
    <div className="pchat">
      {/* 移动端抽屉遮罩 */}
      <div
        className={`pchat__overlay ${sidebarOpen ? "is-open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* 侧栏 */}
      <aside className={`pchat__sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="pchat__brand">POJU</div>
        <button className="pchat__newbtn" onClick={onNewSession} disabled={newSessionDisabled}>
          <span>+ New POJU</span>
          <span>$9.99</span>
        </button>
        <div className="pchat__sessions-label">Sessions</div>
        <div className="pchat__sessions">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`pchat__session ${
                s.id === currentSessionId ? "is-active" : ""
              }`}
              onClick={() => {
                onSelectSession(s.id);
                setSidebarOpen(false);
              }}
            >
              <span className="pchat__session-title">{s.title}</span>
              {onDeleteSession && (
                <button
                  className="pchat__session-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                >
                  ⋯
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* 主区 */}
      <main className="pchat__main">
        <header className="pchat__header">
          <button
            className="pchat__hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="pchat__header-title">{activeTitle}</span>
          <span style={{ width: 36 }} />
        </header>

        <div className="pchat__scroll" ref={scrollRef}>
          <div className="pchat__messages">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`pchat__msg pchat__msg--${
                  m.role === "user" ? "user" : "ai"
                }`}
              >
                {m.role === "user" ? (
                  <div className="pchat__bubble">{m.content}</div>
                ) : (
                  <AiReplyShell>
                    {renderAiContent(m.content)}
                    <div className="pchat__msg-actions">
                      <button type="button" className="icon-btn" onClick={() => onCopy?.(m.content)} aria-label="Copy">
                        <span className="material-symbols-outlined">content_copy</span>
                      </button>
                      <button type="button" className="icon-btn" onClick={() => onSpeak?.(m.content)} aria-label="Speak">
                        <span className="material-symbols-outlined">volume_up</span>
                      </button>
                    </div>
                  </AiReplyShell>
                )}
              </div>
            ))}

            {/* 流式:正式回答(逐字) */}
            {isStreaming && streamingText ? (
              <StreamingAssistantBubble content={streamingText} />
            ) : null}
          </div>
        </div>

        {/* 输入框 */}
        <div className="pchat__inputbar">
          {isStreaming && thinkingMode ? (
            liveThinkingLine ? (
              <LiveThinkingTicker line={liveThinkingLine} waitingLabel={thinkingWaitLabel} />
            ) : (
              <ThinkingStream mode={thinkingMode} locale={thinkingLocale ?? "en"} />
            )
          ) : null}
          <div className="pchat__inputwrap">
            <button type="button" className="icon-btn" aria-label="Attach" onClick={onAttach}>
              <span className="material-symbols-outlined">attach_file</span>
            </button>
            <textarea
              ref={taRef}
              className="pchat__textarea"
              rows={1}
              placeholder={inputPlaceholder ?? "Type your message..."}
              value={textareaValue}
              disabled={isStreaming}
              onChange={(e) => setTextareaValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button type="button" className="icon-btn" aria-label="Voice" onClick={onVoice}>
              <span className="material-symbols-outlined">mic</span>
            </button>
            <button
              type="button"
              className={`icon-btn pchat__send-btn${isStreaming ? " pchat__send-btn--stop" : ""}`}
              onClick={() => {
                if (isStreaming && onStop) {
                  onStop();
                  return;
                }
                send();
              }}
              disabled={!isStreaming && !textareaValue.trim()}
              aria-label={isStreaming ? "Stop" : "Send"}
            >
              <span className="material-symbols-outlined">{isStreaming ? "stop" : "arrow_upward"}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
