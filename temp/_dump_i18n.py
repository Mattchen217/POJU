path = r"D:\POJU\pojulife\public\v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()
# find locale blocks for scenarios
for i, l in enumerate(lines, 1):
    if "eosScenarios" in l or "eos_scenarios" in l or "scenariosHeader" in l:
        print(f"{i}|{l.rstrip()[:180]}")
    if "v2-scenarios-header" in l and i > 3700:
        print(f"{i}|{l.rstrip()[:180]}")
    if "data-eos-scenario" in l and i > 3700:
        print(f"{i}|{l.rstrip()[:180]}")
# dump 2880-3060
print("---LOCALE---")
for i in range(2880, min(3060, len(lines))):
    print(f"{i+1}|{lines[i]}", end="")
print("---APPLY---")
for i in range(3790, min(3860, len(lines))):
    print(f"{i+1}|{lines[i]}", end="")
