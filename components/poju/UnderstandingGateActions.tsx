"use client";

type Props = {
  locale: string;
  busy?: boolean;
  onConfirm: () => void;
  onSupplement: () => void;
};

export function UnderstandingGateActions({
  locale,
  busy = false,
  onConfirm,
  onSupplement,
}: Props) {
  const zh = locale.startsWith("zh");
  const confirmLabel = zh ? "对，就是这样，开始分析" : "Yes — that's right, start analysis";
  const supplementLabel = zh ? "我还想补充一点" : "I want to add something";

  return (
    <div className="poju-understanding-gate" role="group" aria-label={zh ? "理解确认" : "Understanding confirmation"}>
      <button
        type="button"
        className="poju-understanding-gate__btn poju-understanding-gate__btn--primary"
        disabled={busy}
        onClick={onConfirm}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        className="poju-understanding-gate__btn poju-understanding-gate__btn--secondary"
        disabled={busy}
        onClick={onSupplement}
      >
        {supplementLabel}
      </button>
    </div>
  );
}
