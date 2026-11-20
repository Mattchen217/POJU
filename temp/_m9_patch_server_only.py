from pathlib import Path
# package.json script
p = Path(r"D:\POJU\pojulife\package.json")
text = p.read_text(encoding="utf-8")
old = '"test:m9-server-authoritative-session": "tsx scripts/test-m9-server-authoritative-session.ts",'
new = '"test:m9-server-authoritative-session": "tsx --require ./scripts/fixtures/register-server-only.cjs scripts/test-m9-server-authoritative-session.ts",'
if old not in text:
    raise SystemExit("script line not found")
p.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print("updated package.json script")

# switch intake-guard import in route and stream to intake-terminal
for rel in ["app/api/poju/chat/route.ts", "lib/poju/poju-chat-stream.ts"]:
    f = Path(r"D:\POJU\pojulife") / rel
    t = f.read_text(encoding="utf-8")
    t2 = t.replace(
        'import { POJUIntakeTerminalError } from "@/lib/poju/decision-authority/server/intake-guard";',
        'import { POJUIntakeTerminalError } from "@/lib/poju/intake-terminal";',
    )
    if t2 == t:
        raise SystemExit(f"import not found in {rel}")
    f.write_text(t2, encoding="utf-8", newline="\n")
    print("patched", rel)