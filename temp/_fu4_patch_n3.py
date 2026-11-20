from pathlib import Path
import base64, hashlib

helper_b64 = (
    Path(r"D:\POJU\pojulife\temp\_fu4_work_h0.b64").read_text()
    + Path(r"D:\POJU\pojulife\temp\_fu4_work_h1.b64").read_text()
)
helper = base64.b64decode(helper_b64).decode("utf-8")
assert hashlib.sha256(helper.encode()).hexdigest() == "4cc2897a9fafcdee17906caa2423c8eb6b7f4f426ec8f64bb0ce4a0c0d995874"

p = Path(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts")
text = p.read_text(encoding="utf-8")
assert "runFu4WorkRolePending" not in text

marker = '    await check("M2.4-R2-FU4-N3: role choice does not bind a role named only in a negated clause"'
idx = text.find(marker)
assert idx > 0
if not helper.endswith("\n\n"):
    if helper.endswith("\n"):
        helper = helper + "\n"
    else:
        helper = helper + "\n\n"
text = text[:idx] + helper + text[idx:]

start = text.find(marker)
end = text.find('    await check("M2.4-R2-FU4-T:', start)
assert start > 0 and end > start
block = text[start:end]
block2 = block.replace("runFu2NullRolePending", "runFu4WorkRolePending")
assert block2 != block
assert block2.count("runFu4WorkRolePending") >= 2
text = text[:start] + block2 + text[end:]

# Align leftover FU3-E CJK corner quotes to the same 【理解确认】 used by FU4 cases.
old = "includes(\"\u300c\u7406\u89e3\u786e\u8ba4\u300d\")"
new = "includes(\"\u3010\u7406\u89e3\u786e\u8ba4\u3011\")"
print("old quote count", text.count(old), "new already", text.count(new))
if old in text:
    text = text.replace(old, new)
    print("aligned FU3-E readiness quotes")

p.write_text(text, encoding="utf-8", newline="\n")
print("helper refs", text.count("runFu4WorkRolePending"))
print("n3 still fu2", 'runFu2NullRolePending("m24r2fu4n3' in text)
