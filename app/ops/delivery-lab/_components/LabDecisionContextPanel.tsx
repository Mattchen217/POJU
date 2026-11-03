"use client";

/**
 * S3 LAB — Decision Context binding observability (no sensitive snapshot dump).
 */

type Binding = {
  context_id: string;
  context_version: number;
  context_hash: string;
} | null;

export function LabDecisionContextPanel(props: {
  binding: Binding;
  hasSnapshot: boolean;
  status?: string | null;
  deliveryMode?: string | null;
  bodyFeedPresent?: boolean | null;
  bodyFeedHash?: string | null;
}) {
  const b = props.binding;
  if (!b && !props.hasSnapshot) {
    return (
      <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
        <div className="font-medium text-amber-200">Decision Context</div>
        <p className="mt-1 text-[#a1a1aa]">
          未绑定冻结 DC。Stage4 PageFeed / BookJudgment 正式通道未激活（可继续跑 chart-only
          路径）。创建 create 时传入 decision_context_snapshot + binding。
        </p>
      </div>
    );
  }
  return (
    <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-50/90">
      <div className="font-medium text-emerald-200">Decision Context（正式 · 只读）</div>
      <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1 font-mono text-[11px]">
        <dt className="text-[#71717a]">context_id</dt>
        <dd>{b?.context_id ?? "—"}</dd>
        <dt className="text-[#71717a]">version</dt>
        <dd>{b != null ? `v${b.context_version}` : "—"}</dd>
        <dt className="text-[#71717a]">hash</dt>
        <dd className="break-all">{b?.context_hash ?? "—"}</dd>
        <dt className="text-[#71717a]">status</dt>
        <dd>{props.status ?? "—"}</dd>
        <dt className="text-[#71717a]">delivery_mode</dt>
        <dd>{props.deliveryMode ?? "—"}</dd>
        <dt className="text-[#71717a]">snapshot</dt>
        <dd>{props.hasSnapshot ? "present" : "missing"}</dd>
        {props.bodyFeedPresent != null ? (
          <>
            <dt className="text-[#71717a]">body DC feed</dt>
            <dd>
              {props.bodyFeedPresent ? "injected" : "not on this attempt"}
              {props.bodyFeedHash
                ? ` · attempt_hash=${props.bodyFeedHash.slice(0, 16)}…`
                : ""}
            </dd>
          </>
        ) : null}
      </dl>
      <p className="mt-2 text-[10px] text-[#a1a1aa]">
        对照 call_trace ① user_feed 中「Formal Decision Context」块；不得与 binding hash
        不一致。
      </p>
    </div>
  );
}
