# 14 — Birth-info list row (workbench / account cards)

**Surface:** Workbench birth-info record cards (dark gold-border list rows).  
**Status:** Implement locally. Reuse rail title + `SessionStageTimeline` — no forks.

## REMOVE
- Old **5-function icon × count** chips (meditation / people / grid / G / etc.)
- Any per-engine usage chrome on this card

## KEEP
- Birth string (e.g. `1992-04-03 · 14:00 · M`) — existing format
- Created timestamp below birth (same stack; keep shipped `session_prep.created_at` label)

## Row L→R (locked)
1. **Total uses** — Decision-dialogue (`used_in_products.poju`) count only.  
   Label: Total uses / 总使用次数 / Usos totales / Utilisations totales.  
   Number primary; label subtle. Optional tooltip: Decision dialogues / 决策对话.
2. **Birth + Created** — vertical stack
3. **Latest short title** — **SAME string source** as left-rail past-session history titles (`pojuHistoryTitle` / `sessionListTopicLine` + POJU-prefix strip). One line ellipsis. Click opens that session when bound.
4. **Stage progress** — **SAME component** as left-rail (`SessionStageTimeline` / SoT 11): 5 How+Get dots. Bind to latest/linked POJU session for this birth record. Reuse — no fork. `stage={0}` = never used (all gray).
5. **···** overflow far right — existing rename/delete menu only

## Density
- Flex: count fixed min-width · birth ~min 10–12rem · title flex:1 min 0 ellipsis · timeline fixed ~7–9rem · menu icon
- Narrow: wrap once preferred = title+timeline under birth; count + ··· stay first line

## Empty states
| State | Count | Title | Timeline |
| Never used | 0 | No session yet (muted) | all 5 dots gray (`stage={0}`) |
| No title yet | real | Untitled session (muted) | progress for session |
| Mid-session | real | real title | per SoT 11 |

Never hide count. Never resurrect engine chips.

## i18n
Keys under `birthList.*` (EN/ZH/ES/FR):  
`totalUses`, `decisionDialogues`, `noSessionYet`, `untitledSession`, `created`  
Keep existing Created label if already shipped (`session_prep.created_at`).  
`de`: leave alone (EN deep-merge fills gaps).
