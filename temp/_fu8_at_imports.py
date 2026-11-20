from pathlib import Path
p = Path("lib/poju/decision-intake/adaptive-turn.ts")
text = p.read_text(encoding="utf-8")

old = '''  type PendingBindChoice,
} from "./pending-answer-resolution";
'''
new = '''  type PendingBindChoice,
} from "./pending-answer-resolution";
import {
  attachIntakeControlFromEvent,
  buildEnteredBlueprintUpdatePlan,
  buildIntakeControlPlan,
  controlWithPlan,
  isActivePendingIntakeControl,
  isControlClarificationUncertain,
  isIntakeControlPlan,
  nextPendingControlItem,
  parseGoalChangeConfirmation,
  updateControlItemStatus,
  withPendingIntakeControl,
} from "./pending-intake-control";
'''
assert old in text
text = text.replace(old, new, 1)

old = '''  PendingAnswerResolution,
  UnderstandingState,
} from "./types";
'''
new = '''  PendingAnswerResolution,
  PendingIntakeControl,
  UnderstandingState,
} from "./types";
'''
assert old in text
text = text.replace(old, new, 1)

p.write_text(text.replace("\r\n","\n"), encoding="utf-8", newline="\n")
print("imports added")
