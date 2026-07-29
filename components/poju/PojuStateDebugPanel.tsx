import type { PojuStateSnapshot } from "@/lib/poju/agent-state-snapshot";

type Props = {
  snapshot: PojuStateSnapshot;
  locale: string;
};

function flag(ok: boolean): string {
  return ok ? "✓" : "✗";
}

export function PojuStateDebugPanel({ snapshot, locale }: Props) {
  const zh = locale.startsWith("zh");
  const label = zh ? "状态机 · 调试面板" : "State machine · debug";
  const items = [
    { n: "①", zh: "问题理解", en: "Problem", ok: snapshot.problem_understood },
    { n: "②", zh: "处境洞察", en: "Situation", ok: snapshot.relationship_conclusion },
    { n: "③", zh: "行动骨架", en: "Action frames", ok: snapshot.breakthrough_direction },
    { n: "④", zh: "议程已建", en: "Agenda", ok: snapshot.agenda_built },
    {
      n: "⑤",
      zh: `收集 ${snapshot.agenda_progress}`,
      en: `Collect ${snapshot.agenda_progress}`,
      ok: snapshot.agenda_built && snapshot.agenda_progress !== "0/0",
    },
    { n: "⑥", zh: "已交付", en: "Delivered", ok: snapshot.delivered },
  ];

  return (
    <div className="poju-state-debug" aria-label={label}>
      <div className="poju-state-debug__title">{label}</div>
      <div className="poju-state-debug__phase">
        phase: <code>{snapshot.phase}</code>
      </div>
      <div className="poju-state-debug__flags">
        {items.map((item) => (
          <span key={item.n} className={item.ok ? "poju-state-debug__ok" : "poju-state-debug__no"}>
            {item.n} {zh ? item.zh : item.en} {flag(item.ok)}
          </span>
        ))}
      </div>
    </div>
  );
}
