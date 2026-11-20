import sys
sys.stdout.reconfigure(encoding="utf-8")
t=open(r"D:\POJU\pojulife\lib\poju\decision-intake\answer-interpretation.ts",encoding="utf-8").read().splitlines()
for i,l in enumerate(t,1):
    if "extractedIndex" in l or "pushUnresolvedItem" in l or "unlocated_role" in l:
        print(f"{i}:{l}")
