type Props = {
  locale: string;
};

export function LlmDebugModeBanner({ locale }: Props) {
  const zh = locale.startsWith("zh");
  return (
    <div className="poju-llm-debug-banner" role="status">
      <span className="poju-llm-debug-banner__dot" aria-hidden />
      {zh
        ? "LLM 调试模式已开启 — 数据在每条 AI 回复正文下方（关闭：URL 加 ?debug=0）"
        : "LLM debug mode ON — stats below each AI reply (disable: add ?debug=0 to URL)"}
    </div>
  );
}
