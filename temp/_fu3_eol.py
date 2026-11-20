import os
os.chdir(r"D:\POJU\pojulife")
files=[
"lib/poju/decision-intake/types.ts",
"lib/poju/decision-intake/answer-interpretation.ts",
"lib/poju/decision-intake/pending-answer-resolution.ts",
"lib/poju/decision-intake/adaptive-turn.ts",
"lib/poju/decision-intake/apply-answer-to-dc.ts",
"scripts/test-m1-production-adaptive-question-loop.ts",
]
for f in files:
    raw=open(f,"rb").read()
    crlf=raw.count(b"\r\n")
    lf=raw.count(b"\n")-crlf
    print(f, "crlf", crlf, "lf", lf, "bom", raw.startswith(b"\xef\xbb\xbf"))
