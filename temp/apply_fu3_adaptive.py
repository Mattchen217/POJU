import base64, pathlib
root = pathlib.Path(r"D:/POJU/pojulife")
rel = root / "lib/poju/decision-intake/adaptive-turn.ts"
raw = rel.read_text(encoding="utf-8")
nl = "\r\n" if "\r\n" in raw else "\n"
s = raw.replace("\r\n", "\n")
assert "M2.3-R2-FU3: Understanding rebuild failed" not in s
anchor = s.find("let u = understanding0;")
assert anchor > 0
start = s.find("    if (u) {\n      const openP0P1 = openBlueprintP0P1Needs(u);", anchor)
end = s.find("async function planFromState(", start)
assert start > 0 and end > start
fall = s.find('    return {\n      session: current,\n      outcome: "ready_no_question",', start)
assert start < fall < end
B64 = "CiAgICAvLyBNMi4zLVIyLUZVMzogVW5kZXJzdGFuZGluZyByZWJ1aWxkIGZhaWxlZCAodT09bnVsbCkuIENhbm5vdCBpbmZlciBQMC9QMQogICAgLy8gY29tcGxldGUgZnJvbSBtaXNzaW5nIG5lZWRzLiBDb25zZXJ2YXRpdmUgZmFpbC1jbG9zZWQgd2hpbGUgQmx1ZXByaW50CiAgICAvLyBleGlzdHMgYW5kIGhhcmQgYnVkZ2V0IG1heSByZW1haW4gLS0gbmV2ZXIgcmVhZHlfbm9fcXVlc3Rpb24gLyBmcmVlLWFzay4KICAgIGlmICghdSAmJiBjdXJyZW50LmRlY2lzaW9uX2JsdWVwcmludCkgewogICAgICBsZXQgaGFyZEJ1ZGdldFJlbWFpbnMgPSB0cnVlOwogICAgICB0cnkgewogICAgICAgIGNvbnN0IGhhcmQgPSBjdXJyZW50LmRlY2lzaW9uX2JsdWVwcmludC5xdWVzdGlvbl9idWRnZXQuaGFyZDsKICAgICAgICBjb25zdCBhc2tlZCA9CiAgICAgICAgICBjdXJyZW50LmRlY2lzaW9uX3VuZGVyc3RhbmRpbmc/LmJ1ZGdldD8uc2Vzc2lvbl9hc2tlZF9jb3VudCA/PyAwOwogICAgICAgIGhhcmRCdWRnZXRSZW1haW5zID0gaGFyZCAtIGFza2VkID4gMDsKICAgICAgfSBjYXRjaCB7CiAgICAgICAgLy8gQ2Fubm90IHJlYWQgYnVkZ2V0IGVpdGhlciAtLSB0cmVhdCBhcyByZW1haW5pbmcgKGZhaWwtY2xvc2VkKS4KICAgICAgICBoYXJkQnVkZ2V0UmVtYWlucyA9IHRydWU7CiAgICAgIH0KICAgICAgaWYgKGhhcmRCdWRnZXRSZW1haW5zKSB7CiAgICAgICAgcmV0dXJuIHsKICAgICAgICAgIHNlc3Npb246IGN1cnJlbnQsCiAgICAgICAgICBvdXRjb21lOiAicGxhbm5lcl9ibG9ja2VkIiwKICAgICAgICAgIGFza19lcnJvcjogYHVuZGVyc3RhbmRpbmdfZXhjZXB0aW9uOiR7ZXJyfWAsCiAgICAgICAgICBhbnN3ZXJfZXZlbnQsCiAgICAgICAgICB1bmRlcnN0YW5kaW5nOiBudWxsLAogICAgICAgICAgcGxhbjogbnVsbCwKICAgICAgICAgIGF1dGhvcml6ZWRfcXVlc3Rpb246IG51bGwsCiAgICAgICAgICBwZXJzaXN0X2Vycm9yLAogICAgICAgIH07CiAgICAgIH0KICAgIH0KCg=="
insert = base64.b64decode(B64).decode()
s2 = s[:fall] + insert + s[fall:]
out = s2.replace("\n", "\r\n") if nl == "\r\n" else s2
rel.write_text(out, encoding="utf-8", newline="")
print("adaptive ok", len(out))
