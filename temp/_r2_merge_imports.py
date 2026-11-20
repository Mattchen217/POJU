from pathlib import Path
p = Path(r"lib/poju/agent.ts")
text = p.read_text(encoding="utf-8")
text = text.replace(
    'import type { POJUAction, POJUSessionState, POJUMessage } from "@/lib/poju/types";',
    'import type { AssistantHistoryAttestation, POJUAction, POJUSessionState, POJUMessage, ToolSuggestionPayload } from "@/lib/poju/types";',
    1,
)
# remove duplicate type imports if now redundant
text = text.replace('import type { ToolSuggestionPayload } from "@/lib/poju/types";\n', '', 1)
text = text.replace('import type { AssistantHistoryAttestation } from "@/lib/poju/types";\n', '', 1)
# ensure ToolSuggestionPayload is still imported (used)
if "ToolSuggestionPayload" in text and "import type { AssistantHistoryAttestation, POJUAction, POJUSessionState, POJUMessage, ToolSuggestionPayload }" not in text:
    raise SystemExit("failed to merge types import")
p.write_text(text, encoding="utf-8", newline="\n")
print("merged agent types import")
for i,l in enumerate(text.splitlines(),1):
    if "from \"@/lib/poju/types\"" in l:
        print(f"{i}:{l}")
