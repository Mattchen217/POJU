from pathlib import Path
test_path = Path(r"D:\POJU\pojulife\scripts\test-m1-production-adaptive-question-loop.ts")
fragment = Path(r"D:\POJU\pojulife\temp\_fu4_tests_fragment.ts").read_text(encoding="utf-8")
fu3e = Path(r"D:\POJU\pojulife\temp\_fu4_fu3e_replacement.ts").read_text(encoding="utf-8")
text = test_path.read_text(encoding="utf-8")
start = text.find('    await check("M2.4-R2-FU3-E: refusal is auditable, not a fact, and survives reload"')
end_marker = "\n    await check(\"M2.4-R2-FU3-F:"
end = text.find(end_marker, start)
print("markers", start, end)
assert start > 0 and end > start
text = text[:start] + fu3e.rstrip() + text[end:]
marker = "    const modelSrc = readFileSync("
idx = text.find(marker)
print("modelSrc", idx)
assert idx > 0
frag = fragment.rstrip() + "\n\n"
text = text[:idx] + frag + text[idx:]
test_path.write_text(text, encoding="utf-8", newline="\n")
print("spliced", test_path.stat().st_size, text.count("\n")+1)
print("FU4-A", "M2.4-R2-FU4-A" in text)
print("old jump assert", "must not silently jump to another NeedItem" in text)
print("FU3-F still", "M2.4-R2-FU3-F" in text)
print("honest comment", "Honest FU4 change" in text)
print("modelSrc still", text.count("const modelSrc = readFileSync"))
