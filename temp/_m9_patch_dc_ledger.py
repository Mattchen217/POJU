from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\agent.ts")
text = p.read_text(encoding="utf-8")
old = '''          decision_blueprint: sessionForLlm.decision_blueprint,
          decision_understanding: sessionForLlm.decision_understanding,
          adaptive_ask_plan: sessionForLlm.adaptive_ask_plan,
          intake_ask_plan: sessionForLlm.intake_ask_plan,
          session_revision: sessionForLlm.session_revision,
          dc_write_revision: sessionForLlm.dc_write_revision,
'''
new = '''          decision_blueprint: sessionForLlm.decision_blueprint,
          decision_understanding: sessionForLlm.decision_understanding,
          adaptive_ask_plan: sessionForLlm.adaptive_ask_plan,
          intake_ask_plan: sessionForLlm.intake_ask_plan,
          dc_ledger: sessionForLlm.dc_ledger ?? workingSession.dc_ledger,
          dc_freeze_receipts: sessionForLlm.dc_freeze_receipts ?? workingSession.dc_freeze_receipts,
          dc_profile_receipts: sessionForLlm.dc_profile_receipts ?? workingSession.dc_profile_receipts,
          session_revision: sessionForLlm.session_revision,
          dc_write_revision: sessionForLlm.dc_write_revision,
'''
if old not in text:
    raise SystemExit("workingSession field copy not found")
p.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print("patched agent workingSession authority mirrors")