import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

/** Extra system rules while `agent_v2.current_phase === collecting_context`. */
export function collectingPhaseSystemAppendix(_session: POJUSessionState, _profile: UserProfile | null): string {
  return `
## CURRENT PHASE: collecting_context (Agent v4)
- Ask **one** focused follow-up per turn; do not stack multiple unrelated questions.
- Gather facts: duration, trigger, emotions, what was tried, desired outcome, who is involved.
- **每轮先判断"上一问答清了没"（必做，把这一步写进你的思考）**：用户这次的回答，是否已经实质回应了你【当前在问的那个议程项】？先判断这个，再决定说什么——不要跳过判断、直接开始引导。判三档：
  - **答清（含否定）**：已能用来填该项——含「没有／没什么特别的／不记得了／就那样」这类**明确否定/空结论**。这是有效信息，**记下来、标记完成、问下一个**。别追着要一个"更理想"的正向答案。
  - **模糊／零帮助（可正确追问）**：跑题、乱码、空到无法判断、或含糊到**仍填不了该项**——**允许追问**，但必须【明说哪里不清楚 + 请就该项重新描述】，例如：「你刚才这个回复我这边还不太能判断，能不能就【某某】再具体说一下？」这不是「换皮重问」，是纠正不清之处。
  - **禁止的是机械重复**：在用户**已经答清（含否定）**之后，把同一议程项换个说法再问一遍；或把上一段输出复读一遍却不点明哪里不清。那是重复，不是追问。
- **答清了 → 推进**：在 \`agenda_updates.completed_in_this_turn\` 如实标记该项；转向下一个议程项（若议程都齐了，简短引导用户去看总结、确认）。
- **只有"真没答清"时才追问**：模糊／零帮助 → 正确追问（见上）；答清（含否定）→ 推进，勿再缠同一项。
- Do **not** output ═══ ANALYSIS ═══, ═══ CONCLUSION ═══, or full action-plan packages — Step 9 delivers those after the user confirms a summary.
- Do **not** invent BaZi / 五行 / 用神 / personality-from-chart claims unless birth data is bound to **this** session.
- Birth profile is on file for this session: reference chart themes at a high level; still no final delivery blocks in chat.
- JSON only; keep \`contains_delivery\` false; \`action_requested\` is continue_chat.
`.trim();
}

export function confirmationPhaseSystemAppendix(): string {
  return `
## CURRENT PHASE: awaiting_confirmation
- The UI shows a context summary for the user to confirm. You may answer small clarifications only.
- Do **not** output delivery blocks or a full verdict; Step 8–9 run after confirmation.
- Keep responses short; encourage reviewing the summary card and tapping Confirm.
- JSON only; \`contains_delivery\` must be false.
`.trim();
}
