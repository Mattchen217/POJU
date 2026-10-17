from pathlib import Path
t = Path(r"app/[locale]/terms/page.tsx").read_text(encoding="utf-8")
for n in ["Buy Pass", "buy pass", "one-time", "PASS", "carryover", "subscription", "flex", "purchased", "Spend", "spend order", "priority"]:
    print(n, t.lower().count(n.lower()))
# show lines with carryover
for i,line in enumerate(t.splitlines(),1):
    if "carryover" in line.lower() or "spend" in line.lower() and "order" in line.lower() or "one-time" in line.lower() and "PASS" in line:
        print(f"L{i}: {line[:140]}")
print("--- refund Buy Pass context ---")
r = Path(r"app/[locale]/refund/page.tsx").read_text(encoding="utf-8")
for i,line in enumerate(r.splitlines(),1):
    if "Buy Pass" in line or "unused" in line.lower() and "PASS" in line:
        print(f"L{i}: {line[:160]}")
        if i>200: break
# verify chinese codepoints in disclaimer
d = Path(r"app/[locale]/disclaimer/page.tsx").read_text(encoding="utf-8")
i = d.find("PENDING COUNSEL REVIEW")
chunk = d[i:i+40]
print("codepoints:", [hex(ord(c)) for c in chunk])
