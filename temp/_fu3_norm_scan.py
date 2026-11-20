import sys,re
sys.stdout.reconfigure(encoding="utf-8")
text=open(r"D:\POJU\pojulife\lib\poju\decision-intake\answer-interpretation-model.ts",encoding="utf-8").read()
print("normalizeComparable count", text.count("normalizeComparable"))
# show function def and usages
for i,l in enumerate(text.splitlines(),1):
    if "normalizeComparable" in l:
        print(f"{i}:{l}")
