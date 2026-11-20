from pathlib import Path

# Verify agent HandleInput structure
t = Path("lib/poju/agent.ts").read_text(encoding="utf-8")
i = t.find("export interface HandleInput")
print(t[i:i+900])
print("---")
# Verify Case B end / Case E
tt = Path("scripts/test-m2-3-decision-blueprint.ts").read_text(encoding="utf-8")
ib = tt.find("Orchestrator + collecting layers above already proved")
print("Case B note:", tt[ib-200:ib+500])
print("====")
ie = tt.find("M2.3-R2-FU4 Case E")
print("Case E:", tt[ie:ie+2200])
print("====TAILS====")
print(tt[-800:])
