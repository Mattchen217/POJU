type Props = {
  locale: string;
};

export function LlmDebugModeBanner({ locale }: Props) {
  const zh = locale.startsWith("zh");
  return (
    <div className="poju-llm-debug-banner" role="status">
      <span className="poju-llm-debug-banner__dot" aria-hidden />
      {zh
        ? "LLM 调试模式已开启 — 信息在每条 AI 回复正文下方（旧消息/欢迎语无数据，请发送新消息）"
        : "LLM debug mode ON — info appears below each AI reply body (old/welcome messages have no data; send a new message)"}
    </div>
  );
}
