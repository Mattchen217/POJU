"use client";

type Props = {
  ledger: unknown;
};

export function StateMachineDebugPanel({ ledger }: Props) {
  if (process.env.NODE_ENV !== "development" || !ledger) return null;

  return (
    <aside className="poju-debug-panel" aria-label="State machine debug panel">
      <div className="poju-debug-title">状态机监控 · DEV</div>
      <pre className="poju-debug-pre">
        <code>{JSON.stringify(ledger, null, 2)}</code>
      </pre>
    </aside>
  );
}
