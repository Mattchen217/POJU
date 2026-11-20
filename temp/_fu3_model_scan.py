import sys,re
sys.stdout.reconfigure(encoding="utf-8")
text=open(r"D:\POJU\pojulife\lib\poju\decision-intake\answer-interpretation-model.ts",encoding="utf-8").read()
# search dedupe, unique, text, extracted
for i,l in enumerate(text.splitlines(),1):
    if re.search(r'dedupe|unique|Set\(|extracted_items|same text|seen', l, re.I):
        print(f"{i}:{l}")
