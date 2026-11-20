from pathlib import Path
p = Path(r"D:\POJU\pojulife\package.json")
text = p.read_text(encoding="utf-8")
needle = '    "test:m8-r1-internal-turn-trust-boundary": "tsx scripts/test-m8-r1-internal-turn-trust-boundary.ts",'
insert = needle + '\n    "test:m9-server-authoritative-session": "tsx scripts/test-m9-server-authoritative-session.ts",'
if "test:m9-server-authoritative-session" in text:
    print("script already present")
else:
    if needle not in text:
        raise SystemExit("package.json needle not found")
    p.write_text(text.replace(needle, insert, 1), encoding="utf-8", newline="\n")
    print("added test script")