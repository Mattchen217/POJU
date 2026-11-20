from pathlib import Path
msg = """fix(decision-intake): M2.4-R2-FU9 source-content grounding and insight-mismatch resolution

Require extracted item.text to equal source_quote before any model-derived DC write, and persist the original unnormalized quote. Interpret insight_mismatch clarifications through the legal C1 path, keep the item pending on failure, and extract goal_change targets from grounded definition_patch phrases only.
"""
Path(r"D:\POJU\pojulife\temp\COMMIT_MSG_R2FU9_IMPL.txt").write_text(msg, encoding="utf-8", newline="\n")
print("wrote impl message")