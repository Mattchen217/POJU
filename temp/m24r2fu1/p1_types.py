# types patch
from pathlib import Path
import os
root = Path(os.environ.get("POJU_ROOT", os.getcwd()))
path = root / "lib/poju/decision-intake/types.ts"
text = path.read_text(encoding="utf-8")
old = """  extracted_items: Array<{
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    role_hint: string | null;
    certainty: "explicit" | "estimated" | "unclear";
  }>;
"""
new = """  extracted_items: Array<{
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    /** Legacy role-name hint; kept for historical drafts only. Not an authorization basis. */
    role_hint: string | null;
    /**
     * Full authorized role code `v1/dir/{dir_id}/role/{role}`.
     * Optional on historical drafts / test fixtures; missing is treated as null.
     * Production model output should always include this field (string or null).
     */
    role_code_hint?: string | null;
    certainty: "explicit" | "estimated" | "unclear";
  }>;
"""
if old not in text:
    raise SystemExit("types.ts block missing")
if text.count(old) != 1:
    raise SystemExit("types.ts block ambiguous")
path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print("patched types.ts")
