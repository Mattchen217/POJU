from pathlib import Path
msg = "fix(decision-intake): M2.4-R2-FU8 source grounding and intake control flow\n"
Path("temp/_fu8_commit_impl_msg.txt").write_text(msg, encoding="utf-8", newline="\n")
print("wrote impl commit message")
