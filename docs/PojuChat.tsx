"use client";

/* ============================================================
   PojuChat.tsx  —  POJU 聊天页组件(Claude 规格,PC + PWA)
   ------------------------------------------------------------
   UI / 布局 / 尺寸全部由本组件 + poju-chat.css 控制,
   数据通过 props 接入(Cursor 把现有 store / api 接到这些 props)。
   图标用 emoji 占位,可替换成 lucide-react 等现有图标库。
   ============================================================ */

import { useState, useRef, useEffect, type JSX } from "react";
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
  thinkingText?: string;  // THINKING 单行滚动文本(可选)
  onSend: (text: string) => void;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onCopy?: (text: string) => void;
  onSpeak?: (text: string) => void;
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

export default function PojuChat(props: PojuChatProps) {
  const {
    sessions, currentSessionId, messages,
    isStreaming, streamingText, thinkingText,
    onSend, onNewSession, onSelectSession, onDeleteSession, onCopy, onSpeak,
  } = props;

  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* 输入框自适应高度 */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  /* 新消息 / 流式时自动滚到底 */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [messages, streamingText, thinkingText]);

  const send = () => {
    const t = input.trim();
    if (!t || isStreaming) return;
    onSend(t);
    setInput("");
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
        <button className="pchat__newbtn" onClick={onNewSession}>
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
                  <div className="pchat__ai">
                    {renderAiContent(m.content)}
                    <div className="pchat__msg-actions">
                      <button onClick={() => onCopy?.(m.content)} aria-label="Copy">
                        ⧉
                      </button>
                      <button onClick={() => onSpeak?.(m.content)} aria-label="Speak">
                        🔊
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* 流式:THINKING 单行滚动(看得到在输出,看不清内容) */}
            {isStreaming && thinkingText && (
              <div className="pchat__msg pchat__msg--ai">
                <div
                  style={{
                    fontSize: 13,
                    color: "#8a849c",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    opacity: 0.7,
                  }}
                >
                  {thinkingText}
                </div>
              </div>
            )}

            {/* 流式:正式回答(逐块) */}
            {isStreaming && streamingText && (
              <div className="pchat__msg pchat__msg--ai">
                <div className="pchat__ai">{renderAiContent(streamingText)}</div>
              </div>
            )}
          </div>
        </div>

        {/* 输入框 */}
        <div className="pchat__inputbar">
          <div className="pchat__inputwrap">
            <button className="pchat__iconbtn" aria-label="Attach">
              📎
            </button>
            <textarea
              ref={taRef}
              className="pchat__textarea"
              rows={1}
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button className="pchat__iconbtn" aria-label="Voice">
              🎤
            </button>
            <button
              className="pchat__send"
              onClick={send}
              disabled={isStreaming || !input.trim()}
              aria-label="Send"
            >
              ↑
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
